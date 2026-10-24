var PC = PC || {};
PC.fe = PC.fe || {};
PC.fe.models = PC.fe.models || {};

// Backbone.emulateHTTP = true;
PC.actionParameter = 'pc_get_data';
// Backbone.Model.prototype.toJSON = function() {
// 	var json = PC._us.clone(this.attributes);
// 	for(var attr in json) {
// 		if((json[attr] instanceof Backbone.Model) || (json[attr] instanceof Backbone.Collection)) {
// 			json[attr] = json[attr].toJSON(); 
// 		}
// 	}
// 	return json;
// };

!( function( $, _ ) {
	'use strict';

	PC.fe.config = PC.fe.config || PC_config.config;
	PC.fe.config = _.extend( {}, PC.fe.config);
	PC.fe.products_content = PC.fe.products_content || [];
	PC.fe.headless = false;
	// Alias for PC.fe.modal (session/controller). Block work can use this name instead of "modal".
	PC.fe.ui = PC.fe.ui || null;

	// Validation: UI, live summary sync, and shared errors array (see PC.fe.validation.errors).
	PC.fe.validation = PC.fe.validation || {};
	PC.fe.validation.errors = PC.fe.validation.errors || [];
	PC.fe.errors = PC.fe.validation.errors;

	PC.fe.validation.detach_live_sync = function() {
		var live = PC.fe.validation._live;
		if ( ! live ) return;
		wp.hooks.removeAction( 'PC.fe.choice.set_choice', 'mkl/pc-validation-live' );
		if ( PC.fe.layers && live._onLayerCshow ) {
			PC.fe.layers.off( 'change:cshow', live._onLayerCshow );
		}
		if ( live.$container && live._onFieldInput ) {
			live.$container.off( '.mklPcValLive' );
		}
		if ( live._debounced && live._debounced.cancel ) {
			live._debounced.cancel();
		}
		PC.fe.validation._live = null;
	};

	PC.fe.validation.error_layer_id = function( error ) {
		if ( ! error ) return null;
		if ( error.layer ) return error.layer.id;
		if ( error.choice && error.choice.get ) return error.choice.get( 'layerId' );
		return null;
	};

	PC.fe.validation.error_touches_layer = function( error, layerId ) {
		return PC.fe.validation.error_layer_id( error ) === layerId;
	};

	PC.fe.validation.live_errors_equivalent = function( a, b ) {
		if ( ! a || ! b ) return false;
		var la = a.layer ? a.layer.id : null;
		var lb = b.layer ? b.layer.id : null;
		var ca = a.choice && a.choice.get ? a.choice.get( 'layerId' ) : null;
		var cb = b.choice && b.choice.get ? b.choice.get( 'layerId' ) : null;
		var ida = la != null ? la : ca;
		var idb = lb != null ? lb : cb;
		if ( ida == null || idb == null || ida !== idb ) return false;
		var ac = a.choice ? a.choice.id : null;
		var bc = b.choice ? b.choice.id : null;
		if ( ( ac == null ) !== ( bc == null ) ) return false;
		if ( ac != null && ac !== bc ) return false;
		return true;
	};

	PC.fe.validation.clear_error_annotations_for_index = function( error, errorIndex, $container ) {
		if ( ! error || ! $container || ! $container.length ) return;
		var errListId = 'mkl-pc-validation-error-' + errorIndex;
		if ( error.choice ) {
			var $choice = PC.fe.validation.get_choice_target( $container, error.choice );
			if ( $choice.length ) {
				$choice.removeAttr( 'aria-invalid' );
				var choice_describedby = ( $choice.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
				choice_describedby = choice_describedby.filter( function( item ) {
					return item !== errListId;
				} );
				if ( choice_describedby.length ) {
					$choice.attr( 'aria-describedby', choice_describedby.join( ' ' ) );
				} else {
					$choice.removeAttr( 'aria-describedby' );
				}
				if ( $choice.attr( 'data-pc-validation-describedby' ) === errListId ) {
					$choice.removeAttr( 'data-pc-validation-describedby' );
				}
			}
			error.choice.set( 'has_error', false );
		}
		if ( error.layer ) {
			var $layer = $container.find( '#config-layer-' + error.layer.id ).first();
			if ( $layer.length ) {
				$layer.removeAttr( 'aria-invalid' );
				var layer_describedby = ( $layer.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
				layer_describedby = layer_describedby.filter( function( item ) {
					return item !== errListId;
				} );
				if ( layer_describedby.length ) {
					$layer.attr( 'aria-describedby', layer_describedby.join( ' ' ) );
				} else {
					$layer.removeAttr( 'aria-describedby' );
				}
				if ( $layer.attr( 'data-pc-validation-describedby' ) === errListId ) {
					$layer.removeAttr( 'data-pc-validation-describedby' );
				}
			}
			error.layer.set( 'has_error', false );
		}
	};

	PC.fe.validation.remove_one_error_row = function( row ) {
		var live = PC.fe.validation._live;
		if ( ! live || ! row || row.removed ) return;
		PC.fe.validation.clear_error_annotations_for_index( row.error, row.errorIndex, live.$container );
		if ( live.$summary && live.$summary.length ) {
			live.$summary.find( '#mkl-pc-validation-error-' + row.errorIndex ).remove();
		}
		row.removed = true;
	};

	PC.fe.validation.update_summary_counts = function() {
		var live = PC.fe.validation._live;
		if ( ! live || ! live.$summary || ! live.$summary.length ) return;
		var remaining = _.filter( live.rows, function( r ) {
			return ! r.removed;
		} ).length;
		if ( ! remaining ) {
			PC.fe.validation.clear_errors();
			return;
		}
		var count_text = ( live._countTemplate || '%d errors found.' ).replace( '%d', remaining );
		var focus_moved = live._focusMovedText || '';
		var $sr = live.$summary.find( '.mkl-pc-validation-summary__title .screen-reader-text' );
		if ( $sr.length ) {
			$sr.text( count_text + ' ' + focus_moved );
		}
	};

	PC.fe.validation.sync_error_rows_for_layer_ids = function( layerIds ) {
		var live = PC.fe.validation._live;
		if ( ! live || ! live.rows || ! PC.fe.save_data || ! PC.fe.save_data.collect_errors_for_layer ) return;
		layerIds = layerIds || [];
		_.each( layerIds, function( layerId ) {
			if ( layerId == null ) return;
			var layer = PC.fe.layers && PC.fe.layers.get ? PC.fe.layers.get( layerId ) : null;
			if ( ! layer ) return;
			var fresh = PC.fe.save_data.collect_errors_for_layer( layer );
			_.each( live.rows, function( row ) {
				if ( row.removed || ! PC.fe.validation.error_touches_layer( row.error, layerId ) ) return;
				var still = _.some( fresh, function( fe ) {
					return PC.fe.validation.live_errors_equivalent( row.error, fe );
				} );
				if ( ! still ) {
					PC.fe.validation.remove_one_error_row( row );
				}
			} );
		} );
		PC.fe.validation.update_summary_counts();
	};

	PC.fe.validation.queue_row_sync_for_layer = function( layerId ) {
		var live = PC.fe.validation._live;
		if ( ! live || layerId == null || ! live._debounced ) return;
		live.pendingLayerIds[ layerId ] = true;
		live._debounced();
	};

	PC.fe.validation.attach_live_sync = function( state ) {
		PC.fe.validation.detach_live_sync();
		var live = _.extend( {
			rows: [],
			pendingLayerIds: {},
			$container: null,
			$summary: null,
			goto_items_by_index: {},
			_countTemplate: '%d errors found.',
			_focusMovedText: '',
		}, state );
		PC.fe.validation._live = live;

		live._debounced = _.debounce( function() {
			var current = PC.fe.validation._live;
			if ( ! current || ! current.pendingLayerIds ) return;
			var ids = _.keys( current.pendingLayerIds );
			current.pendingLayerIds = {};
			PC.fe.validation.sync_error_rows_for_layer_ids( _.map( ids, function( x ) {
				return parseInt( x, 10 );
			} ) );
		}, 180 );

		live._onChoiceSet = function( model ) {
			if ( ! model || ! model.get ) return;
			var lid = model.get( 'layerId' );
			if ( lid != null ) {
				PC.fe.validation.queue_row_sync_for_layer( lid );
			}
		};
		wp.hooks.addAction( 'PC.fe.choice.set_choice', 'mkl/pc-validation-live', live._onChoiceSet, 20 );

		live._onLayerCshow = function( model ) {
			if ( ! model || model.get( 'cshow' ) !== false ) return;
			var lid = model.id;
			var rows = live.rows;
			_.each( rows, function( row ) {
				if ( row.removed || ! PC.fe.validation.error_touches_layer( row.error, lid ) ) return;
				PC.fe.validation.remove_one_error_row( row );
			} );
			PC.fe.validation.update_summary_counts();
		};
		if ( PC.fe.layers && PC.fe.layers.on ) {
			PC.fe.layers.on( 'change:cshow', live._onLayerCshow );
		}

		live._onFieldInput = function( event ) {
			var el = event.target;
			if ( ! el || ! el.id ) return;
			var m = el.id.match( /^pc-field-(\d+)-/ );
			var layerId = m ? parseInt( m[1], 10 ) : null;
			if ( layerId == null ) {
				m = el.id.match( /^choice_(\d+)_/ );
				if ( m ) layerId = parseInt( m[1], 10 );
			}
			if ( layerId != null ) {
				PC.fe.validation.queue_row_sync_for_layer( layerId );
			}
		};
		if ( live.$container && live.$container.length ) {
			live.$container.on( 'input.mklPcValLive change.mklPcValLive', 'input, textarea, select', live._onFieldInput );
		}
	};

	/**
	 * DOM node to focus / mark invalid for a choice error.
	 * Standard layers use #choice_{layerId}_{id}; Form / Text overlay use #pc-field-{layerId}-{id} (or radio ids with a numeric suffix).
	 */
	PC.fe.validation.get_choice_target = function( $scope, choice ) {
		if ( ! choice || ! $scope || ! $scope.length ) return $();
		var layerId = choice.get( 'layerId' );
		var choiceId = choice.id;
		var $t = $scope.find( '#choice_' + layerId + '_' + choiceId ).first();
		if ( $t.length ) return $t;
		var fieldSel = '#pc-field-' + layerId + '-' + choiceId;
		$t = $scope.find( fieldSel ).first();
		if ( $t.length ) {
			var tag = ( $t.prop( 'tagName' ) || '' ).toLowerCase();
			if ( tag === 'input' || tag === 'textarea' || tag === 'select' ) {
				return $t;
			}
			var $inner = $t.find( 'input:not([type="hidden"]), textarea, select' ).filter( ':visible' ).first();
			return $inner.length ? $inner : $t;
		}
		return $scope.find( 'input[type="radio"][id^="pc-field-' + layerId + '-' + choiceId + '-"]' ).filter( ':visible' ).first();
	};

	PC.fe.validation.clear_errors = function() {
		PC.fe.validation.detach_live_sync();
		var $summary = $( '.mkl-pc-validation-summary' ).first();
		if ( $summary.length ) {
			$summary.empty().attr( 'hidden', 'hidden' );
			$( 'body' ).removeClass( 'has-validation-errors' );
		}
		$( '.mkl_pc .mkl_pc_container .mkl_pc_toolbar [aria-invalid="true"]' ).removeAttr( 'aria-invalid' );
		$( '.mkl_pc .mkl_pc_container .mkl_pc_toolbar [data-pc-validation-describedby]' ).each( function() {
			var id = $( this ).attr( 'data-pc-validation-describedby' );
			var describedby = ( $( this ).attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
			describedby = describedby.filter( function( item ) {
				return item !== id;
			} );
			if ( describedby.length ) {
				$( this ).attr( 'aria-describedby', describedby.join( ' ' ) );
			} else {
				$( this ).removeAttr( 'aria-describedby' );
			}
			$( this ).removeAttr( 'data-pc-validation-describedby' );
		} );
	};

	PC.fe.validation.show_errors = function( errors ) {
		errors = errors || [];
		var modal = PC.fe.modal || {};
		var $container = ( modal.$main_window && modal.$main_window.length ) ? modal.$main_window : $( '.mkl_pc.opened .mkl_pc_container' ).first();
		if ( ! $container.length ) $container = $( '.mkl_pc .mkl_pc_container:visible' ).first();
		if ( ! $container.length ) return false;

		var $toolbar = ( modal.toolbar && modal.toolbar.$el && modal.toolbar.$el.length ) ? modal.toolbar.$el : $container.find( '.mkl_pc_toolbar' ).first();
		if ( ! $toolbar.length ) $toolbar = $container;

		var $selection = ( modal.toolbar && modal.toolbar.$selection && modal.toolbar.$selection.length ) ? modal.toolbar.$selection : $toolbar.find( 'section.choices' ).first();

		var default_placement = ( $selection && $selection.length )
			? { method: 'before', $target: $selection }
			: { method: 'prepend', $target: $toolbar };
		var placement_context = { $container: $container, $toolbar: $toolbar, $selection: $selection, modal: modal };
		var placement = wp.hooks.applyFilters( 'PC.fe.validation.summary_placement', default_placement, placement_context );
		if ( ! placement || ! placement.$target || ! placement.$target.length ) {
			placement = default_placement;
		} else {
			var m = placement.method;
			if ( m !== 'before' && m !== 'prepend' && m !== 'after' && m !== 'append' ) {
				placement = default_placement;
			}
		}

		function place_validation_summary( $el, p ) {
			if ( ! $el || ! $el.length || ! p || ! p.$target || ! p.$target.length ) return;
			switch ( p.method ) {
				case 'prepend':
					p.$target.prepend( $el );
					break;
				case 'append':
					p.$target.append( $el );
					break;
				case 'after':
					$el.insertAfter( p.$target );
					break;
				default:
					$el.insertBefore( p.$target );
			}
		}

		var $summary = $container.find( '.mkl-pc-validation-summary' ).first();
		if ( ! $summary.length ) {
			$summary = $( '<div class="mkl-pc-validation-summary" role="alert" aria-live="assertive" aria-atomic="true" tabindex="-1" hidden="hidden"></div>' );
		}
		place_validation_summary( $summary, placement );
		PC.fe.validation.clear_errors();
		
		$( 'body' ).addClass( 'has-validation-errors' );

		var messages = [];
		var message_items = [];
		var live_rows = [];
		var goto_items_by_index = {};
		var first_focus_target = null;
		var first_goto_item = null;
		_.each( errors, function( error, index ) {
			var plain_message = PC.utils.strip_html( error.message || '' );
			if ( plain_message ) messages.push( plain_message );

			var $focus_target = null;
			var goto_item = null;
			var target_id = '';

			if ( error.choice ) {
				error.choice.set( 'has_error', error.message );
				var $choice = PC.fe.validation.get_choice_target( $container, error.choice );
				$focus_target = $choice;
				goto_item = error.choice;
				if ( ! first_focus_target && $choice.length ) {
					first_focus_target = $choice;
					first_goto_item = error.choice;
				}
				if ( $choice.length ) {
					$choice.attr( 'aria-invalid', 'true' );
					target_id = $choice.attr( 'id' ) || '';
					if ( ! target_id ) {
						target_id = 'mkl-pc-validation-target-' + index;
						$choice.attr( 'id', target_id );
					}
					var choice_error_id = 'mkl-pc-validation-error-' + index;
					$choice.attr( 'data-pc-validation-describedby', choice_error_id );
					var choice_describedby = ( $choice.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
					if ( choice_describedby.indexOf( choice_error_id ) === -1 ) {
						choice_describedby.push( choice_error_id );
						$choice.attr( 'aria-describedby', choice_describedby.join( ' ' ) );
					}
				}
			}
			if ( error.layer ) {
				error.layer.set( 'has_error', error.message );
				var $layer = $container.find( '#config-layer-' + error.layer.id ).first();
				if ( ! $focus_target || ! $focus_target.length ) {
					$focus_target = $layer;
					goto_item = error.layer;
				}
				if ( ! first_focus_target && $layer.length ) {
					first_focus_target = $layer;
					first_goto_item = error.layer;
				}
				if ( $layer.length ) {
					$layer.attr( 'aria-invalid', 'true' );
					if ( ! target_id ) {
						target_id = $layer.attr( 'id' ) || '';
						if ( ! target_id ) {
							target_id = 'mkl-pc-validation-target-' + index;
							$layer.attr( 'id', target_id );
						}
					}
					var layer_error_id = 'mkl-pc-validation-error-' + index;
					$layer.attr( 'data-pc-validation-describedby', layer_error_id );
					var layer_describedby = ( $layer.attr( 'aria-describedby' ) || '' ).split( /\s+/ ).filter( Boolean );
					if ( layer_describedby.indexOf( layer_error_id ) === -1 ) {
						layer_describedby.push( layer_error_id );
						$layer.attr( 'aria-describedby', layer_describedby.join( ' ' ) );
					}
				}
			}

			if ( plain_message ) {
				message_items.push( { message: plain_message, target_id: target_id, index: index } );
				live_rows.push( { errorIndex: index, error: error, removed: false } );
				if ( goto_item || ( $focus_target && $focus_target.length ) ) {
					goto_items_by_index[ index ] = { item: goto_item, $focus: $focus_target };
				}
			}
		} );

		var summary_title = ( PC_config.lang && PC_config.lang.validation_error_list_label ) ? PC_config.lang.validation_error_list_label : 'Please review the following errors:';
		var summary_count_template = ( PC_config.lang && PC_config.lang.validation_errors_found ) ? PC_config.lang.validation_errors_found : '%d errors found.';
		var count_text = summary_count_template.replace( '%d', messages.length );
		var focus_moved_text = ( PC_config.lang && PC_config.lang.validation_focus_moved_to_summary ) ? PC_config.lang.validation_focus_moved_to_summary : 'Focus moved to validation summary.';
		var html = '<p class="mkl-pc-validation-summary__title">' + summary_title + ' <span class="screen-reader-text">' + count_text + ' ' + focus_moved_text + '</span></p><ul>';
		_.each( message_items, function( item ) {
			var inner = item.message;
			if ( item.target_id ) {
				inner = '<a class="mkl-pc-validation-summary__error-link" href="#' + _.escape( item.target_id ) + '" data-validation-index="' + item.index + '">' + _.escape( item.message ) + '</a>';
			} else {
				inner = _.escape( item.message );
			}
			html += '<li id="mkl-pc-validation-error-' + item.index + '">' + inner + '</li>';
		} );
		html += '</ul>';
		$summary.html( html ).removeAttr( 'hidden' );
		$summary.find( '.mkl-pc-validation-summary__error-link' ).on( 'click', function( event ) {
			var idx = parseInt( $( this ).attr( 'data-validation-index' ), 10 );
			if ( isNaN( idx ) ) return;
			var payload = goto_items_by_index[ idx ];
			if ( payload && payload.item && PC.fe.goto ) {
				event.preventDefault();
				PC.fe.goto( payload.item, { $container: $container, focusEl: payload.$focus, should_scroll: true } );
			} else if ( payload && payload.$focus && payload.$focus.length ) {
				event.preventDefault();
				payload.$focus.trigger( 'focus' );
			}
		} );

		if ( live_rows.length ) {
			PC.fe.validation.attach_live_sync( {
				rows: live_rows,
				$container: $container,
				$summary: $summary,
				goto_items_by_index: goto_items_by_index,
				_countTemplate: summary_count_template,
				_focusMovedText: focus_moved_text,
			} );
		}

		if ( PC.fe.a11y.announce ) {
			PC.fe.a11y.announce( count_text + ' ' + focus_moved_text );
		}

		setTimeout( function() {
			$summary.trigger( 'focus' );
		}, 50 );
		return false;
	};

	// Legacy aliases (extensions may still call these).
	PC.fe.clear_validation_errors = PC.fe.validation.clear_errors;
	PC.fe.show_validation_errors = PC.fe.validation.show_errors;
	PC.fe.get_choice_validation_target = PC.fe.validation.get_choice_target;

	PC.fe.a11y = PC.fe.a11y || {};

	if ( ! PC.fe.a11y.focus_without_scroll ) {
		PC.fe.a11y.focus_without_scroll = function( $target ) {
			PC.fe.a11y.focus( $target, true );
		};
	}

	if ( ! PC.fe.a11y.focus ) {
		PC.fe.a11y.focus = function( $target, prevent_scroll = false ) {
			if ( ! $target || ! $target.length ) return;
			if ( !prevent_scroll ) {
				$target.trigger( 'focus' );
				return;
			}
			var el = $target.get( 0 );
			if ( ! el || ! el.focus ) return;
			el.focus( { preventScroll: true } );
		};
	}

	/**
	 * Modal / toolbar focusable selector (excludes tabindex="-1", e.g. inner choice buttons).
	 */
	PC.fe.a11y.modal_focusable_selector = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	/**
	 * Narrow selector for first focus inside a choices panel (inputs + non-skipped buttons).
	 */
	PC.fe.a11y.choices_panel_focusable_selector = 'input, select, textarea, button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])';

	PC.fe.a11y.is_focusable_enabled = function( el ) {
		var $el = $( el );
		if ( ! $el.length ) return false;
		if ( $el.is( ':disabled' ) ) return false;
		if ( 'true' === $el.attr( 'aria-disabled' ) ) return false;
		if ( $el.is( 'input[type="hidden"]' ) ) return false;
		return true;
	};

	PC.fe.a11y.filter_focusable = function( $collection ) {
		return $collection.filter( ':visible' ).filter( function() {
			return PC.fe.a11y.is_focusable_enabled( this );
		} );
	};

	/**
	 * Focus first visible enabled control in $scope matching selector (default: choices panel set).
	 */
	PC.fe.a11y.focus_first_in_scope = function( $scope, selector ) {
		if ( ! $scope || ! $scope.length ) return $();
		selector = selector || PC.fe.a11y.choices_panel_focusable_selector;
		var $target = PC.fe.a11y.filter_focusable( $scope.find( selector ) ).first();
		if ( $target.length ) {
			PC.fe.a11y.focus_without_scroll( $target );
		}
		return $target;
	};

	/**
	 * Run focusFn after .layer_choices transition when active, else after a short delay.
	 */
	PC.fe.a11y.focus_after_panel_transition = function( $panel, focusFn, options ) {
		options = options || {};
		var timeoutMs = options.timeoutMs !== undefined ? options.timeoutMs : 350;
		var delayIfInactive = options.delayIfInactive !== undefined ? options.delayIfInactive : 50;
		var namespace = options.namespace || 'mklPcFocus';
		if ( ! $panel || ! $panel.length || ! $panel.hasClass( 'active' ) ) {
			setTimeout( focusFn, delayIfInactive );
			return;
		}
		var done = false;
		var cleanup = function() {
			$panel.off( 'transitionend.' + namespace );
		};
		var finish = function() {
			if ( done ) return;
			done = true;
			cleanup();
			focusFn();
		};
		$panel.on( 'transitionend.' + namespace, function( event ) {
			if ( event && event.target !== $panel.get( 0 ) ) return;
			finish();
		} );
		setTimeout( function() {
			cleanup();
			finish();
		}, timeoutMs );
	};

	if ( ! PC.fe.goto ) {
		/**
		 * Navigate to a layer / choice, opening its parent hierarchy if needed.
		 * Intended for validation, summary navigation, etc.
		 *
		 * @param {Object} options
		 * @param {boolean} [options.should_scroll=false] When true, focus uses the browser default (element scrolled into view). Otherwise uses preventScroll.
		 */
		PC.fe.goto = function( item, options ) {
			options = options || {};
			var applyFocus = options.should_scroll ? PC.fe.a11y.focus : PC.fe.a11y.focus_without_scroll;
			
			var modal = PC.fe.modal || {};

			var $container = options.$container || ( modal.$main_window && modal.$main_window.length ? modal.$main_window : $() );
			if ( ! $container.length ) $container = $( '.mkl_pc.opened .mkl_pc_container' ).first();
			if ( ! $container.length ) $container = $( '.mkl_pc .mkl_pc_container:visible' ).first();

			var layerId = null;
			if ( item ) {
				// Choice model
				if ( item.get && item.get( 'layerId' ) !== undefined && item.get( 'layerId' ) !== null ) {
					layerId = item.get( 'layerId' );
				// Layer model
				} else if ( item.id !== undefined && item.get && item.get( 'type' ) !== undefined ) {
					layerId = item.id;
				// Plain object
				} else if ( item.layerId !== undefined && item.layerId !== null ) {
					layerId = item.layerId;
				} else if ( item._id !== undefined && item._id !== null ) {
					layerId = item._id;
				}
			}

			var layers = options.layers || PC.fe.layers;
			if ( ! layers || ! layerId ) {
				if ( options.focusEl && options.focusEl.length ) {
					setTimeout( function() { applyFocus( options.focusEl ); }, 500 );
				}
				return false;
			}

			var layer = layers.get ? layers.get( layerId ) : null;
			if ( ! layer ) {
				if ( options.focusEl && options.focusEl.length ) {
					setTimeout( function() { applyFocus( options.focusEl ); }, 500 );
				}
				return false;
			}

			// Build hierarchy from root -> leaf
			var hierarchy = [];
			var cursor = layer;
			var guard = 0;
			while ( cursor && guard++ < 50 ) {
				hierarchy.unshift( cursor.id );
				var parentId = cursor.get ? cursor.get( 'parent' ) : null;
				if ( ! parentId ) break;
				cursor = ( cursor.collection && cursor.collection.get ) ? cursor.collection.get( parentId ) : ( layers.get ? layers.get( parentId ) : null );
			}

			// Activate each layer in order
			_.each( hierarchy, function( id ) {
				var layer_model = layers.get ? layers.get( id ) : null;
				var is_active = layer_model && layer_model.get ? ( true === layer_model.get( 'active' ) ) : false;
				var $li = $container.find( '.layers-list-item[data-layer="' + id + '"]' ).first();
				if ( ! $li.length && modal.$el && modal.$el.length ) {
					$li = modal.$el.find( '.layers-list-item[data-layer="' + id + '"]' ).first();
				}
				if ( $li.length ) {
					if ( ! is_active && $li.hasClass( 'active' ) ) is_active = true;
					if ( is_active ) return;
					var view = $li.data( 'view' );
					if ( view && view.show_choices ) {
						view.show_choices( null, true );
					} else {
						// Avoid toggling closed: only click if not active
						$li.find( '> button.layer-item' ).first().trigger( 'click' );
					}
				}
			} );

			// Focus after UI settles (panel transitions can otherwise force scrolling).
			var $focusTarget = $();
			if ( options.focusEl && options.focusEl.length ) {
				$focusTarget = options.focusEl.first();
			} else if ( options.focusChoice && item && item.get && $container.length && PC.fe.validation.get_choice_target ) {
				$focusTarget = PC.fe.validation.get_choice_target( $container, item );
			}
			if ( $focusTarget && $focusTarget.length ) {
				var $panel = $focusTarget.closest( '.layer_choices' );
				PC.fe.a11y.focus_after_panel_transition( $panel, function() {
					applyFocus( $focusTarget );
				}, {
					namespace: 'mklPcGotoFocus',
					timeoutMs: 350,
					delayIfInactive: 50,
				} );
			}

			return true;
		};
	}

	if ( ! PC.fe.a11y.announce ) {
		PC.fe.a11y._announce_state = PC.fe.a11y._announce_state || { last_message: '', last_ts: 0 };
		PC.fe.a11y.announce = function( message, options ) {
			if ( ! message ) return;
			options = options || {};
			var dedupe_window = typeof options.dedupe_window === 'number' ? options.dedupe_window : 700;
			var normalized = String( message ).replace( /\s+/g, ' ' ).trim();
			if ( ! normalized ) return;
			var now = Date.now();
			if ( PC.fe.a11y._announce_state.last_message === normalized && ( now - PC.fe.a11y._announce_state.last_ts ) < dedupe_window ) {
				return;
			}
			var $region = $( '.mkl-pc-live-region' ).first();
			if ( ! $region.length ) return;
			PC.fe.a11y._announce_state.last_message = normalized;
			PC.fe.a11y._announce_state.last_ts = now;
			$region.text( '' );
			setTimeout( function() {
				$region.text( normalized );
			}, 15 );
		};
	}

	$( function() {
		// adds classes to body
		if( PC.utils._isTouch() ){
			$( 'body' ).addClass( 'is-touch' );
		}

		if( PC.utils._isMobile() ){
			$( 'body' ).addClass( 'is-mobile' );
		}

		// Check if the open_configurator is in the URL
		if ( ! PC.fe.config.open_configurator ) {
			var urlParams = new URLSearchParams( location.search );
			if ( urlParams.has( 'open_configurator' ) ) PC.fe.config.open_configurator = true;
		}

		// keyboard-navigation

		$( 'body' ).on( 'keydown', function( e ) {
			if ( $( this ).hasClass( 'keyboard-navigation' ) ) return;
			if ( 'Tab' == e.key && ! e.ctrlKey ) {
				$( this ).addClass( 'keyboard-navigation' );
				PC.fe.keyboard_navigation = true;
			}
		} );

		$( 'body' ).on( 'pointerdown mousedown touchstart', function() {
			if ( !$( this ).hasClass( 'keyboard-navigation' ) ) return;
			$( this ).removeClass( 'keyboard-navigation' );
			PC.fe.keyboard_navigation = false;
		});

		PC.fe.product_type = PC.fe.product_type || 'simple';

		function configurator_init( event ) {

			event.preventDefault();

			if ( PC.fe.config.current_language ) {
				PC.fe.lang = PC.fe.config.current_language;
				PC.utils.add_language_filters( PC.fe.lang );
			}
			var product_id, price;
			var $target = $( event.target );
			if ( ! $target.is( '.configure-product' ) ) {
				$target = $target.closest( '.configure-product' );
			}

			if ( $target.data( 'product_id' ) ) {
				product_id = $target.data( 'product_id' );
				if ( $target.is( '.is-shortcode' ) ) {
					PC.fe.is_using_shortcode = true;
				} else {
					PC.fe.is_using_shortcode = false;
				}
			} else if ( $('*[name="add-to-cart"]').length ) {
				PC.fe.is_using_shortcode = false;
				product_id = $('*[name="add-to-cart"]').val();
			}
			
			if ( ! product_id ) {
				console.log ( 'No product ID was found' );
				return;
			}

			var reset = false;
			if ( $target.data( 'preset' ) ) {
				if ( ! PC.fe.initial_preset || PC.fe.initial_preset && PC.fe.initial_preset != $target.data( 'preset' ) ) {
					reset = true;
				}
				PC.fe.initial_preset = $target.data( 'preset' );
			}

			if ( $target.data( 'view' ) ) {
				PC.fe.initial_view = $target.data( 'view' );
			}

			if ( 'mkl/pc/inline-init' == event.type ) {
				PC.fe.inline = true;
				PC.fe.inlineTarget = event.target;
			}

			// Open configurator
			try {
				PC.fe.open( product_id, product_id, $target, reset );
			} catch ( err ) {
				console.error( 'we had an error: ', err );
				console.trace( err );
				// PC.fe.close();
			}
		}

		$( 'body' ).on( 'click', '.configure-product-redq_rental', configurator_init );
		$( 'body' ).on( 'click', '.configure-product-simple', configurator_init );
		$( 'body' ).on( 'mkl/pc/inline-init', '.mkl-configurator-inline', configurator_init );

		PC.fe.get_product_forms().each(function(index, form) {

			if ( $( 'body' ).is( '.is_configurable' ) && ! $( 'body' ).is( '.enable-add-to-cart' ) ) $( form ).find( 'button[name="add-to-cart"]' ).prop( 'disabled', 'disabled' );
			$( form ).on( 'submit', function( event ) {
				var $data = $( form ).find( 'input[name=pc_configurator_data]' );
				$data.val( PC.fe.save_data.save() );
				if( $data.val() == '' ) {
					event.preventDefault(); 
					console.log('empty data'); 
				}
			} );
		} );

		/**
		 * Automaticly switch angles
		 */
		function auto_angle_switch( view ) {
			if ( view.model.get( 'angle_switch' ) && 'no' != view.model.get( 'angle_switch' ) )  {
				if ( false === view.model.get( 'cshow' ) ) return;
				var new_angle = PC.fe.angles.get( view.model.get( 'angle_switch' ) );
				if ( new_angle && ! new_angle.get( 'active' ) ) {
					new_angle.collection.each( function( model ) {
						model.set( 'active', false ); 
					});		
					new_angle.set( 'active', true );
				}
		 	}
		}

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {

			PC.fe.get_product_forms().find( 'button[name="add-to-cart"]' ).prop( 'disabled', false );

			// Register every quantity input as a view of PC.fe.get_qty(). This
			// replaces a document-delegated mirror that copied one input's value
			// into the others: it was re-bound on every start and never removed,
			// and because .val() fires no change event, a change on the product
			// form never reached product_info.qty. bind_qty_input is idempotent.
			PC.fe.bind_qty_input( PC.fe.get_product_forms().find( 'input[name=quantity]' ).add( '.mkl_pc input[name=quantity]' ) );

			// Blocksy buttons compat
			if ( 'object' === typeof ctFrontend && ctFrontend.hasOwnProperty( 'handleEntryPoints' ) && ctFrontend.hasOwnProperty( 'allFrontendEntryPoints' ) ) ctFrontend.handleEntryPoints( ctFrontend.allFrontendEntryPoints );

			// Savoy compatibility
			if ( $.nmThemeInstance && $.nmThemeInstance.quantityInputsBindButtons ) $.nmThemeInstance.quantityInputsBindButtons( $('.mkl_pc') );

			if ( 'function' === typeof avadaAddQuantityBoxes ) avadaAddQuantityBoxes();
			// The configuration is reset before the views are built now - see
			// PC.fe.prepare_initial_state(). Resetting again here would undo the
			// configuration just loaded from the cart or from a saved design.

			// Swipe (DOM: skip when headless or when the layers element is missing)
			if ( ! PC.fe.is_headless() && PC_config.config.swipe_to_change_view && 1 < PC.fe.angles.length ) {
				var $layers = $( '.mkl_pc_layers' );
				if ( $layers.length && $.fn.swipe ) {
					var swipeOptions = {
						triggerOnTouchEnd: true,
						swipeStatus: function( event, phase, direction, distance ) {
							var current_angle = PC.fe.angles.findWhere( { active: true } );
							var current_index = PC.fe.angles.indexOf( current_angle );
							var new_angle = false;
							var previous_angle = 0 <= ( current_index - 1 ) ? PC.fe.angles.at( current_index - 1) : false;
							var next_angle = PC.fe.angles.at( current_index + 1);
							
							if ( 'end' == phase ) {
								if ( 'right' == direction && previous_angle ) {
									new_angle = previous_angle;
								}

								if ( 'left' == direction && next_angle ) {
									new_angle = next_angle;
								}

								if ( current_angle && new_angle ) {
									current_angle.set( 'active', false );
									new_angle.set( 'active', true );
								}
							}
						},
						allowPageScroll: "vertical",
						threshold: 75
					};
					$layers.swipe( swipeOptions );
				}
			}

		}, 20 );


		// The saved configuration used to be applied here, 300ms after everything
		// had rendered. It is applied before the views are built now - see the
		// 'PC.fe.prepare_config' handler further down. What is left is the opening
		// angle, which is a view concern.
		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
			setTimeout( function() {
				var view_identifier = PC.fe.initial_view || false;
				if ( window.location.hash ) {
					var hash_match = window.location.hash.match(/view=([^,]+)/)
					if ( hash_match && hash_match.length > 1 ) {
						view_identifier = hash_match[1];
					}
				}
				if ( view_identifier ) {
					if ( isNaN( view_identifier ) ) {
						var new_angle = PC.fe.angles.findWhere( { name: view_identifier } );
					} else {
						var new_angle = PC.fe.angles.get( parseInt( view_identifier ) );
					}

					if ( new_angle && ! new_angle.get( 'active' ) ) {
						new_angle.collection.each( function( model ) {
							model.set( 'active', false ); 
						});		
						new_angle.set( 'active', true );
					}
				}
			}, 300 );
		}, 50 );

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
			setTimeout( function() {
				wp.hooks.addAction( 'PC.fe.layer.activate', 'mkl/product_configurator', auto_angle_switch, 20 );
				wp.hooks.addAction( 'PC.fe.choice.activate', 'mkl/product_configurator', auto_angle_switch, 20 );
			}, 310 );
		}, 55 );
		
		/* Display mode Full Screen - on activate layer */
		wp.hooks.addAction( 'PC.fe.layer.activate', 'mkl/product_configurator', function( view ) {
			if ( 'full-screen' === view.model.get( 'display_mode' ) ) {
				$( 'body' ).addClass( 'pc-full-screenlayer--opened' );
			}
		} );

		/* Display mode Full Screen - on deactivate layer */
		wp.hooks.addAction( 'PC.fe.layer.deactivate', 'mkl/product_configurator', function( view ) {
			if ( 'full-screen' === view.model.get( 'display_mode' ) ) {
				$( 'body' ).removeClass( 'pc-full-screenlayer--opened' );
			}
		} );

		if ( PC_config.config.open_first_layer ) {
			wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator', function( configurator ) {
				if ( PC.fe.is_headless() ) return;
				var $first = configurator.$( '.layer-item:visible' ).first();
				if ( $first.parent().is( '.display-mode-dropdown' ) ) return;
				$first.trigger( 'click' );
			}, 60 );
		}


		/**
		 * Launch the configurator inline
		 */
		$( '.mkl-configurator-inline' ).trigger( 'mkl/pc/inline-init' );

		/**
		 * Launch the configurator after click
		 */
		if ( PC.fe.config.open_configurator && true == PC.fe.config.open_configurator && ! $( '.mkl-configurator-inline' ).length ) {
			$( '.configure-product-simple' ).first().trigger( 'click' );
		}

		// WooCommerce Currency Switcher (Curcy) - cache compat
		jQuery(document.body).on('wmc_cache_compatible_finish', function( event, data ) {
			if ( data.format ) {
				// Override loaded format
				_.each( data.format, ( item, key ) => {
					PC_config.lang[key] = item;
				} )
			}

			// Override currency rate
			if ( data.rate ) {
				PC.fe.config.wcpbc_rate = PC_config.config.wcpbc_rate = data.rate;
			}

			// Trigger events to re-render price elements
			wp.hooks.doAction( 'PC.fe.extra_price.after.get_tax_rates' );
			if ( PC.fe && PC.fe.modal ) {
				PC.fe.modal.trigger( 'PC.fe.extra_price.update_taxes' );
			}
		} );

	} );

	/**
	 * Whether engine mode is on (do not auto-mount viewer / toolbar / footer).
	 * Filter `PC.fe.headless` — default is `!! PC.fe.headless`.
	 *
	 * @return {boolean}
	 */
	PC.fe.is_headless = function() {
		return !! wp.hooks.applyFilters( 'PC.fe.headless', !! PC.fe.headless );
	};

	/**
	 * Assign the session/controller. `PC.fe.ui` is an alias of `PC.fe.modal`.
	 *
	 * @param {Object} modal
	 * @return {Object}
	 */
	PC.fe.set_modal = function( modal ) {
		PC.fe.modal = modal;
		PC.fe.ui = modal;
		return modal;
	};

	/**
	 * Load configurator JSON for a product if it is not already in PC.productData.
	 *
	 * @param {number} product_id
	 * @param {Object}  [options]
	 * @param {boolean} [options.omitImages] Pass omit_images=1 on the fetch (PHP strips URLs after cache).
	 * @param {jQuery}  [options.$element]   Button to toggle the loading-data class.
	 * @return {Promise<Object>}
	 */
	PC.fe.ensureProductData = function( product_id, options ) {
		options = options || {};
		var key = 'prod_' + product_id;
		PC.productData = window.PC.productData || PC.productData || {};

		if ( PC.productData[ key ] && ! options.omitImages ) {
			return Promise.resolve( PC.productData[ key ] );
		}

		if ( options.$element ) {
			options.$element.addClass( 'loading-data' );
		}

		wp.hooks.doAction( 'mkl_pc.product_data.loading', product_id );

		// Prefer the cached JSON file, carried as a data attribute on the trigger
		// element (see get_configurator_element_attributes in frontend-woocommerce.php -
		// same mechanism as data-price/data-regular_price). This avoids rebuilding the
		// payload from postmeta chunks on every open. Reading it off the element rather
		// than a page-wide JS global means it works the same whether there is one
		// trigger or several (e.g. multiple [mkl_configurator_button] shortcodes for
		// different products on one page).
		//
		// Not usable for omitImages: the cached file is the full payload, image URLs
		// included, so an engine-only consumer that asked for them to be stripped has to
		// go through the ajax endpoint that does the stripping.
		var cached_url = ( ! options.omitImages && options.$element ) ? options.$element.data( 'config_data_url' ) : null;

		var ajax_url = PC_config.ajaxurl + '?action=pc_get_data&data=init&fe=1&id=' + product_id;
		if ( PC_config.update_nonce ) {
			ajax_url += '&nonce=' + encodeURIComponent( PC_config.update_nonce );
		}
		if ( options.omitImages ) {
			ajax_url += '&omit_images=1';
		}

		var load = function( url ) {
			return fetch( url ).then( function( response ) {
				if ( ! response.ok ) {
					throw new Error( 'HTTP ' + response.status );
				}
				return response.json();
			} );
		};

		var request;

		if ( cached_url && cached_url !== ajax_url ) {
			// The cached file is linked unconditionally, whether or not it exists yet:
			// its URL is printed into markup that is itself page-cached, and a cache
			// purge deletes the file at the same moment (see get_config_file_url in
			// cache.php). Normally a request for a missing one is rescued by
			// Cache::check_and_regenerate_js_file, which rebuilds and serves it.
			//
			// That rescue needs the server to route a miss under wp-content/uploads/ to
			// index.php. Plenty of setups do not: an nginx vhost serving static assets
			// with `try_files $uri =404`, uploads offloaded to S3, a CDN negative-caching
			// the 404. There the request fails outright, so fall back to the ajax
			// endpoint - which also covers a truncated or half-written file, since a body
			// that will not parse as JSON lands in the same catch.
			request = load( cached_url ).catch( function( error ) {
				console.warn( 'Product configurator: cached data file unavailable (' + error.message + '), falling back to the ajax endpoint.' );
				return load( ajax_url );
			} );
		} else {
			request = load( ajax_url );
		}

		return request.then( function( data ) {
			PC.productData = window.PC.productData || {};
			PC.productData[ key ] = data;

			if ( options.$element ) {
				options.$element.removeClass( 'loading-data' );
			}

			wp.hooks.doAction( 'mkl_pc.product_data.loaded', product_id );
			return data;
		} ).catch( function( error ) {
			if ( options.$element ) {
				options.$element.removeClass( 'loading-data' );
			}
			console.error( 'Product configurator: could not load data', error );
			throw error;
		} );
	};

	/**
	 * Detached session/controller used in engine mode. Not inserted into `body`.
	 *
	 * @param {number} product_id
	 * @param {number} parent_id
	 * @return {Backbone.View}
	 */
	PC.fe.create_stub_modal = function( product_id, parent_id ) {
		parent_id = parent_id || product_id;
		if ( PC.fe.views && PC.fe.views.stub_configurator ) {
			return new PC.fe.views.stub_configurator( {
				product_id: product_id,
				parent_id: parent_id
			} );
		}

		// Fallback if views have not loaded: jQuery-only stub with the same surface.
		var $el = $( '<div class="mkl_pc mkl_pc--headless" />' );
		var $main_window = $( '<div class="mkl_pc_container" />' );
		$el.append( $main_window );
		var data_key = 'prod_' + ( ( 'async' !== PC.fe.config.data_mode && parent_id ) ? parent_id : product_id );
		var product_info = ( PC.productData && PC.productData[ data_key ] && PC.productData[ data_key ].product_info ) || {};
		return {
			$el: $el,
			$main_window: $main_window,
			product_id: product_id,
			parent_id: parent_id,
			options: product_info,
			viewer: null,
			toolbar: null,
			footer: null,
			$: function( selector ) {
				return $el.find( selector );
			},
			trigger: function() {
				$el.trigger.apply( $el, arguments );
				return this;
			},
			on: function() {
				$el.on.apply( $el, arguments );
				return this;
			},
			off: function() {
				$el.off.apply( $el, arguments );
				return this;
			},
			open: function() {},
			close: function() {},
			remove: function() {
				$el.remove();
			},
			resetConfig: PC.fe.reset_configuration
		};
	};

	/**
	 * Bring the models to their opening state, before any view is built.
	 *
	 * The order is the point: default selections first, then the configuration
	 * being edited (a cart line item, a saved design or a preset), then
	 * conditional logic - which add-ons hook onto 'PC.fe.prepare_config'. By the
	 * time the toolbar and the viewer are mounted every `cshow` is final, so they
	 * can build only what is actually visible.
	 *
	 * This used to run the other way round: everything rendered, then
	 * 'PC.fe.start' reset the configuration (priority 20) and ran conditions (30),
	 * and the saved configuration landed 300ms later (50). Layers were therefore
	 * rendered in full and hidden again immediately afterwards.
	 *
	 * @param {Backbone.View} configurator The modal, or the stub in engine mode.
	 */
	PC.fe.prepare_initial_state = function( configurator ) {
		if ( ! PC.fe.contents || ! PC.fe.contents.content ) return;

		wp.hooks.doAction( 'PC.fe.prepare_config.before', configurator );

		if ( wp.hooks.applyFilters( 'PC.fe.reset.on.start', true ) ) PC.fe.contents.content.resetConfig();

		/**
		 * Set the configuration up before it is rendered. Anything that changes what
		 * is selected belongs here rather than on 'PC.fe.start'.
		 *
		 * @param {Backbone.View} configurator
		 */
		wp.hooks.doAction( 'PC.fe.prepare_config', configurator );
	};

	// Apply the configuration being edited, so conditional logic sees the real
	// selections rather than the defaults.
	wp.hooks.addAction( 'PC.fe.prepare_config', 'mkl/product_configurator', function() {
		if ( PC_config.config.load_config_content && Array.isArray( PC_config.config.load_config_content ) ) {
			PC.fe.setConfig( PC_config.config.load_config_content );
		} else if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}
	}, 20 );

	/**
	 * Reset choices / optional preset / active angle. Shared by the real modal and the stub.
	 */
	PC.fe.reset_configuration = function() {
		if ( PC.fe.contents && PC.fe.contents.content ) {
			PC.fe.contents.content.resetConfig();
		}

		if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}

		if ( PC.fe.angles && 1 < PC.fe.angles.length ) {
			PC.fe.angles.each( function( model ) {
				model.set( 'active', false );
			} );
			PC.fe.angles.first().set( 'active', true );
		}

		wp.hooks.doAction( 'PC.fe.reset_configurator' );
	};

	/**
	 * Boot layers, choices, and addons without building the configurator UI.
	 *
	 * Resolves after collections exist and `PC.fe.start` has fired. Does not insert
	 * `.mkl_pc` into the document, does not add `configurator_is_opened` on body,
	 * and does not call `modal.open()`.
	 *
	 * `headless` / `initEngine` means do not auto-mount viewer/toolbar/footer.
	 * After this promise, `PC.fe.mountViewer( el )` (or `PC.fe.open()`) can still
	 * construct the UI.
	 *
	 * Headless consumers that change form fields without views must
	 * `choice.set( 'field_value', value )` and
	 * `wp.hooks.doAction( 'PC.fe.form.item.change', choice, fakeEvent )`
	 * so Extra Price radio/select extra prices update.
	 *
	 * @param {number}        product_id
	 * @param {number|Object} [parent_id] Parent product id, or options if the parent is omitted.
	 * @param {Object}        [options]
	 * @param {jQuery}        [options.$element]  Trigger used for data-price / data-price_tiers.
	 *                                            Without it, `product_info.price` from `pc_get_data` is kept.
	 * @param {boolean}       [options.omitImages] Fetch pc_get_data with omit_images=1.
	 * @return {Promise}
	 */
	PC.fe.initEngine = function( product_id, parent_id, options ) {
		if ( parent_id && parent_id.jquery ) {
			options = $.extend( { $element: parent_id }, options || {} );
			parent_id = product_id;
		} else if ( parent_id && 'object' === typeof parent_id ) {
			options = parent_id;
			parent_id = product_id;
		}
		options = options || {};
		parent_id = parent_id || product_id;

		PC.fe.headless = true;

		return PC.fe.ensureProductData( product_id, {
			omitImages: !! options.omitImages,
			$element: options.$element
		} ).then( function() {
			if ( product_id != PC.fe.active_product && PC.fe.modal ) {
				PC.fe.modal.remove();
				PC.fe.set_modal( null );
				wp.hooks.doAction( 'PC.fe.reset_product' );
			}

			PC.fe.active_product = product_id;
			PC.fe.parent_product = parent_id;

			if ( ! PC.fe.modal ) {
				PC.fe.set_modal( PC.fe.create_stub_modal( product_id, parent_id ) );
			} else {
				PC.fe.ui = PC.fe.modal;
			}

			PC.fe.init( product_id, parent_id, options.$element );
			return PC.fe;
		} );
	};

	/**
	 * Replace a headless stub with the real configurator view (same product).
	 *
	 * @param {number} product_id
	 * @param {number} parent_id
	 * @param {jQuery} $element
	 * @param {boolean} reset
	 */
	PC.fe.upgrade_headless_to_ui = function( product_id, parent_id, $element, reset ) {
		PC.fe.headless = false;
		PC.fe.opened = true;
		wp.hooks.doAction( 'PC.fe.before_open' );
		$( 'body' ).addClass( 'configurator_is_opened' );
		if ( PC.fe.inline ) $( 'body' ).addClass( 'configurator_is_inline' );

		if ( PC.fe.modal ) {
			PC.fe.modal.remove();
			PC.fe.set_modal( null );
		}

		PC.fe.set_modal( new PC.fe.views.configurator( { product_id: product_id, parent_id: parent_id } ) );
		PC.fe.trigger_el = $element;

		if ( $element && PC.fe.currentProductData && PC.fe.currentProductData.product_info ) {
			PC.fe.currentProductData.product_info.price = $element.data( 'price' ) || 0;
			PC.fe.currentProductData.product_info.price_tiers = $element.data( 'price_tiers' );
			PC.fe.currentProductData.product_info.regular_price = $element.data( 'regular_price' );
			PC.fe.currentProductData.product_info.is_on_sale = ( 1 == $element.data( 'is_on_sale' ) );
		}

		if ( reset ) {
			PC.fe.reset_configuration();
		}

		// Collections already exist. Skip reset-on-start so lite/engine state is kept.
		wp.hooks.addFilter( 'PC.fe.reset.on.start', 'mkl/product_configurator/upgrade', function() {
			return false;
		} );
		PC.fe.modal.$el.trigger( 'content-is-loaded' );
		wp.hooks.removeFilter( 'PC.fe.reset.on.start', 'mkl/product_configurator/upgrade' );
	};

	PC.fe.init = function( product_id, parent_id, $element ) {
		if ( PC.fe.is_using_shortcode ) {
			this.options = {};
		}

		PC.fe.trigger_el = $element;

		var data_key = ( parent_id && 'async' !== PC.fe.config.data_mode ) ? 'prod_' + parent_id : 'prod_' + product_id;
		var product_data = PC.productData && PC.productData[ data_key ];
		if ( ! product_data || ! product_data.product_info ) {
			console.error( 'Product configurator: missing product data for', product_id );
			return;
		}

		this.currentProductData = product_data;
		this.layers = new PC.layers( product_data.layers );
		this.angles = new PC.angles( product_data.angles, { parse: true } );

		if ( $( $element ).data( 'force_form' ) ) PC.fe.currentProductData.product_info.force_form = true;

		PC.fe.product_type = this.currentProductData.product_info.product_type;
		if ( $element ) {
			this.currentProductData.product_info.price = $element.data( 'price' ) || 0;
			this.currentProductData.product_info.price_tiers = $element.data( 'price_tiers' );
			this.currentProductData.product_info.regular_price = $element.data( 'regular_price' );
			this.currentProductData.product_info.is_on_sale = ( 1 == $element.data( 'is_on_sale' ) );
		} else if ( 'undefined' === typeof this.currentProductData.product_info.price ) {
			// Headless / initEngine: keep Woo price from pc_get_data. Do not zero it.
			this.currentProductData.product_info.price = 0;
		}

		// Seed the quantity from the product form, so opening the configurator
		// keeps whatever the customer already typed there. Silent: nothing is
		// listening yet, and this is the starting value rather than a change.
		// (This used to read the configurator's own input, which does not exist
		// yet at this point, so it always fell back to 1.)
		var $page_qty = PC.fe.get_product_forms().find( 'input[name=quantity]' ).first();
		PC.fe.set_qty( $page_qty.length ? $page_qty.val() : this.currentProductData.product_info.qty, { silent: true } );

		if ( ( 'simple' === PC.fe.product_type && PC.productData['prod_' + product_id] ) || ( 'variation' === PC.fe.product_type && PC.productData['prod_' + product_id] ) ) {
			this.contents = PC.fe.setContent.parse( PC.productData['prod_' + product_id] );
			if ( PC.fe.is_headless() ) {
				// Engine mode: collections are ready. Fire start on the stub; do not build UI.
				PC.fe.prepare_initial_state( this.modal );
				$( PC.fe ).trigger( 'start', this.modal );
				wp.hooks.doAction( 'PC.fe.start', this.modal );
			} else if ( this.modal && this.modal.$el ) {
				this.modal.$el.trigger( 'content-is-loaded' );
			}
		} 

		$( document.body ).trigger( 'mkl-pc-init', product_id, parent_id );
		wp.hooks.doAction( 'PC.fe.init', product_id, parent_id );

	};

	PC.fe.open = function( product_id, parent_id, $element, reset ) {

		parent_id = parent_id ? parent_id : product_id;

		if ( product_id == PC.fe.active_product && PC.fe.headless ) {
			PC.fe.upgrade_headless_to_ui( product_id, parent_id, $element, reset );
			return;
		}

		PC.fe.opened = true;
		wp.hooks.doAction( 'PC.fe.before_open' );
		$('body').addClass('configurator_is_opened');
		if( PC.fe.inline ) $('body').addClass('configurator_is_inline');

		// variations: if product_id is different from active, we remove the modal to create a new one.
		if( product_id == PC.fe.active_product ) {
			// No modal yet: this product's data is still loading, and boot_ui() opens it when it arrives.
			if ( ! this.modal ) return;
			this.modal.open();
			if ( reset && PC.fe.modal ) {
				PC.fe.modal.resetConfig();
			}
			return;
		}

		if ( product_id != PC.fe.active_product && this.modal ) {
			this.modal.remove();
			PC.fe.set_modal( null );
			wp.hooks.doAction( 'PC.fe.reset_product' );
		}

		PC.fe.active_product = product_id; 
		PC.fe.parent_product = parent_id;

		var boot_ui = function() {
			PC.fe.headless = false;
			PC.fe.set_modal( PC.fe.modal || new PC.fe.views.configurator( { product_id: product_id, parent_id: parent_id } ) );
			PC.fe.init( product_id, parent_id, $element );
		};

		if ( PC.productData && PC.productData['prod_'+parent_id] ) {
			boot_ui();
			return;
		}

		PC.fe.config.data_mode = 'async';
		PC.fe.ensureProductData( product_id, { $element: $element } ).then( function( data ) {
			if ( ! data || ! data.layers || ! data.layers.length || ! data.content || ! data.content.length ) {
				console.log( data );
				if ( $element ) {
					$element.after( $( '<div>Error - the configurator data is incomplete. See browser console for data details</div>' ) );
				}
			}
			boot_ui();
		}, function() {
			// Load failures only - an error inside boot_ui() still surfaces as uncaught.
			// ensureProductData() has logged the error. Forget the product so the next click
			// retries the load, instead of finding it "active" with no modal to open.
			if ( product_id == PC.fe.active_product && ! PC.fe.modal ) {
				PC.fe.active_product = false;
				PC.fe.opened = false;
				$( 'body' ).removeClass( 'configurator_is_opened configurator_is_inline' );
			}
		} );

	};

	PC.fe.close = function() {
		if( this.modal ) 
			this.modal.close();
	}

	PC.fe.setContent = {
		url: function() { 
			var action = PC.actionParameter,
				data = 'content';
			return ajaxurl + '?action='+action+'&data='+data+'&id='+this.id
		},

		idAttribute: 'product_id',
		defaults: {
			product_type:'simple', 
			modified: false, 
		}, 
		parse: function( response ) {
			
			wp.hooks.doAction( 'PC.fe.setContent.parse.before', response );

			// var response = null;
			var content = new PC.content_list();
			if( ! response instanceof Object ) {
				return content;
			} else if( undefined == response.content || response.content == false || response.content == 'false' ) {
				return content;
			}

			// content.add( response.content );
			$.each( response.content, function(key, value) {
				var ob = _.clone( value );
				if ( ob.choices && ob.choices.length > 0 && PC.fe.layers.get( ob.layerId ) ) {
					ob.choices = new PC.choices( ob.choices, { layer: PC.fe.layers.get( ob.layerId ) } );
					content.add( ob );
				}
				// content.add({ key = new PC.choices(value);
			});

			// this.set('content', content);
			return { content: content };
			// this.set()
		}
	}; 

	PC.fe.getLayerContent = PC.fe.get_layer_content = function( id ) {
		if ( PC.fe?.contents?.content.get( id ) ) 
			return PC.fe.contents.content.get( id ).attributes.choices; 
		return false;
	};

	PC.fe.get_choice_model = function( layerId, choiceId ) {
		var content = PC.fe.get_layer_content( layerId );
		if ( ! content || ! choiceId ) return false;
		return content.get( choiceId );
	};

	PC.fe.fetchContent = function( product_id ) {
		if ( ! PC.fe.products_content[product_id] ) { 

			this.modal.$el.show();
			this.modal.$el.addClass( 'loading' );

			var request_data = {
				action: PC.actionParameter,
				data: 'content',
				id: product_id,
			};
			if ( PC_config.update_nonce ) {
				request_data.nonce = PC_config.update_nonce;
			}
			$.ajax({
				url:     wp.ajax.settings.url, 
				type: 'POST',
				dataType: 'json',
				data: request_data,
				context: this,
			})
			.done(function( response ) {
				this.modal.$el.removeClass('loading');
				if ( _.isObject( response ) && response.content ) {
					this.contents = PC.fe.setContent.parse( response ); 
					PC.fe.products_content[product_id] = this.contents;
					// Add conditions to the data
					if ( response.conditions ) {
						PC.productData['prod_' + product_id] = PC.productData['prod_' + product_id] || {};
						PC.productData['prod_' + product_id].conditions = response.conditions;
					}
					$( PC.fe ).trigger( 'variation_content_loaded', { response: response, product_id: product_id } );
					wp.hooks.doAction( 'variation_content_loaded', { response: response, product_id: product_id } );
					this.modal.$el.trigger( 'content-is-loaded' );
				} else {
					alert( 'Couldn\'t load Data for this product.' );
					if( PC.fe.inline != true ) {
						this.modal.remove(); 
					}
				}
			})
			.fail(function() {
				console.log("error");
				this.modal.$el.addClass( 'loading' );
			});
		} else {
			this.contents = PC.fe.products_content[product_id];
			this.modal.$el.trigger('content-is-loaded', 'an argument');
		}		
	}
	
	PC.fe.fetchedContent = function( model, response, options ){
		console.log('fetched content');
	}

	/**
	 * The add to cart forms the configurator is responsible for.
	 *
	 * A product page can hold other form.cart elements - related products,
	 * upsells, quick views, a sticky bar from the theme - and the body classes
	 * describe the page, not the form. Only a form that carries the hidden
	 * pc_configurator_data field (printed for configurable products on
	 * woocommerce_after_add_to_cart_button) is ours to disable or guard.
	 *
	 * @return {jQuery}
	 */
	PC.fe.get_product_forms = function() {
		return $( 'input[name=pc_configurator_data]' ).closest( 'form.cart' );
	};

	/*
	 * QUANTITY
	 * ========
	 *
	 * There can be several quantity inputs on a page: WooCommerce's own on the
	 * product form, the one in the configurator, and whatever a theme adds. They
	 * used to be kept in step by copying the value from one input into the
	 * others, which meant the inputs agreed with each other but not necessarily
	 * with product_info.qty - a change made on the product form updated both
	 * boxes without updating the value the price tiers and the extra price
	 * add-on read.
	 *
	 * So the inputs no longer talk to each other. Each one is a view of a single
	 * value: it writes through set_qty() when the customer edits it, and redraws
	 * itself when the value changes, wherever the change came from. Anything
	 * without an input at all - the headless engine, another viewer - just calls
	 * set_qty().
	 */

	/** @type {Array} Inputs registered with PC.fe.bind_qty_input. */
	PC.fe.qty_inputs = [];

	/**
	 * The current quantity, as a number.
	 *
	 * @return {number}
	 */
	PC.fe.get_qty = function() {
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		var qty = info ? parseFloat( info.qty ) : NaN;
		return isNaN( qty ) ? 1 : qty;
	};

	/**
	 * Set the quantity, clamped to what the product allows.
	 *
	 * @param {number|string} value
	 * @param {Object} [options] source: the input being edited, which is left
	 *                           alone while it redraws the others; silent: do not
	 *                           fire PC.fe.qty_changed.
	 * @return {number} The value actually stored.
	 */
	PC.fe.set_qty = function( value, options ) {
		options = options || {};
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		if ( ! info ) return 1;

		var previous = PC.fe.get_qty();
		var qty = parseFloat( value );
		if ( isNaN( qty ) ) qty = previous;

		// Clamped once here, rather than trusting each input's own min/max: the
		// product form's input is rendered by WooCommerce and the configurator
		// never set bounds on it.
		if ( false === info.show_qty ) {
			qty = 1; // Sold individually.
		} else {
			var min = parseFloat( info.qty_min_value );
			var max = parseFloat( info.qty_max_value );
			if ( ! isNaN( min ) && qty < min ) qty = min;
			if ( ! isNaN( max ) && max && qty > max ) qty = max;
			if ( qty < 1 ) qty = 1;
		}

		/**
		 * Filter the quantity before it is stored.
		 *
		 * @param {number} qty
		 * @param {number|string} value The requested value.
		 * @param {Object} options
		 */
		qty = wp.hooks.applyFilters( 'PC.fe.set_qty', qty, value, options );

		info.qty = qty;
		PC.fe.render_qty_inputs();

		if ( ! options.silent && qty !== previous ) {
			wp.hooks.doAction( 'PC.fe.qty_changed', qty, options );
		}

		return qty;
	};

	/**
	 * Write the current quantity into every registered input.
	 *
	 * The input that was just edited is written to as well, so that a value the
	 * product would not accept is corrected in front of the customer instead of
	 * leaving the box showing something the configurator is not using. This is
	 * safe because inputs report on `change`, once editing is finished, not on
	 * every keystroke.
	 */
	PC.fe.render_qty_inputs = function() {
		var qty = PC.fe.get_qty();
		// Drop inputs that went away with a closed configurator.
		PC.fe.qty_inputs = _.filter( PC.fe.qty_inputs, function( el ) {
			return $.contains( document.documentElement, el );
		} );
		_.each( PC.fe.qty_inputs, function( el ) {
			if ( el.value != qty ) el.value = qty;
		} );
	};

	/**
	 * Make an input a view of the quantity: it reports edits, and redraws when
	 * the value changes elsewhere. Idempotent - an input is only bound once.
	 *
	 * @param {Element|jQuery} el
	 */
	PC.fe.bind_qty_input = function( el ) {
		$( el ).each( function() {
			if ( -1 !== _.indexOf( PC.fe.qty_inputs, this ) ) return;
			PC.fe.qty_inputs.push( this );
			$( this ).on( 'change.mkl-pc-qty', function( event ) {
				PC.fe.set_qty( event.target.value, { source: event.target } );
			} );
		} );
		PC.fe.render_qty_inputs();
	};

	// Keep the displayed price in step with the quantity when the Extra price
	// add-on is not installed. This used to live in the form's own change
	// handler, so it only ran for the configurator's input.
	wp.hooks.addAction( 'PC.fe.qty_changed', 'mkl/product_configurator', function() {
		if ( 'undefined' !== typeof pc_get_extra_price ) return;
		var info = PC.fe.currentProductData && PC.fe.currentProductData.product_info;
		if ( ! info || ! info.price_tiers ) return;

		$( '.pc-total-price' ).html( PC.utils.formatMoney( PC.fe.get_product_price() ) );

		if ( info.regular_price && info.is_on_sale && $( '.pc-total--regular-price' ).length ) {
			$( '.pc-total--regular-price' ).html( PC.utils.formatMoney( parseFloat( info.regular_price ) ) );
		}
	} );

	/**
	 * Select a choice and say who did it.
	 *
	 * The entry point for any input surface that is not the sidebar list - a 3D
	 * hotspot, a canvas viewer, the headless engine, third-party code. It makes
	 * the selection and then announces it on `PC.fe.choice.set_choice`, which is
	 * what conditional logic listens to, so a pick behaves the same wherever it
	 * came from.
	 *
	 * `origin` is the important part. Use 'user' when a person chose (that is
	 * what makes a `clicked` rule match, and what lets the open / sync
	 * conditional actions run); use 'restore', 'api' or 'conditional' when the
	 * selection is programmatic, so those actions do not move the interface
	 * under the customer.
	 *
	 * @param {number} layer_id
	 * @param {number} choice_id
	 * @param {boolean} [activate=true]
	 * @param {Object} [options] { origin: 'user'|'restore'|'conditional'|'api', view }
	 * @return {Backbone.Model|false} The choice, or false when it was not found.
	 */
	PC.fe.select_choice = function( layer_id, choice_id, activate, options ) {
		options = options || {};
		var content = PC.fe.getLayerContent( layer_id );
		if ( ! content || ! content.get ) return false;
		var choice = content.get( choice_id );
		if ( ! choice ) return false;

		content.selectChoice( choice_id, 'undefined' === typeof activate ? true : activate );

		wp.hooks.doAction(
			'PC.fe.choice.set_choice',
			choice,
			options.view || null,
			{ origin: options.origin || 'user' }
		);

		return choice;
	};

	PC.fe.setConfig = function( config_items ) {
		
		PC.fe.is_setting_config = true;

		wp.hooks.doAction( 'PC.fe.setConfig.before', config_items );
		// First reset all to the default choice,
		// in case some of the layers in the saved config are missing / extra
		PC.fe.contents.content.resetConfig();

		$.each( config_items, function( index, config_item ) {
			// layerContents is a Backbone.Collection
			try {
				var layer = PC.fe.layers.get( config_item.layer_id );
				if ( layer && 'group' == layer.get( 'type' ) ) return;
				if ( PC.fe.getLayerContent( config_item.layer_id ) && PC.fe.getLayerContent( config_item.layer_id ).selectChoice ) {
					PC.fe.getLayerContent( config_item.layer_id ).selectChoice( config_item.choice_id, true );
				}
				wp.hooks.doAction( 'PC.fe.setConfig.setItem', config_item, PC.fe.getLayerContent( config_item.layer_id ) );
			} catch ( err ) {
				console.log('Product configurator - setConfig: Could not set this layer:', config_item.layer_id, config_item, err);
			}
		} );

		wp.hooks.doAction( 'PC.fe.setConfig', config_items );

		PC.fe.is_setting_config = false;
	};

	PC.fe.get_product_price = function() {
		if ( !PC.fe?.currentProductData ) return 0;
		const { product_info } = PC.fe.currentProductData;
		const qty = product_info.qty;
		let price = parseFloat( product_info?.price );
		
		if ( product_info?.price_tiers && Array.isArray( product_info.price_tiers ) ) {
			const tier = product_info.price_tiers.find( ( item ) => qty >= parseInt( item.start ) );

			if ( tier ) {
				// Percentage or fixed price
				if ( tier.type.includes( 'percent' ) ) {
					price = price - ( parseFloat( tier.price ) * parseFloat( price ) / 100 );
				} else {
					price = parseFloat( tier.price || 0 );
				}
			}
		}
		return price || 0;
	};

	/*
	// product is configurable == true
		// PRODUCT IS SIMPLE 
			-> SERVE Structure and CONTENT
		// Product is VARIABLE
			-> SERVE Structure
			-> on SELECT VARIATION 
				-> Enable Configure button

			-> Configure button .onClick 
				-> GET Content 


	// OPEN CUSTOMIZER 
		// getData
			-> if SIMPLE 
			jSON to COLLECTIONS ANGLES/LAYERS/CONTENT
			-> if VARIATION
			GET VARIATION CONTENT
			jSON to COLLECTIONS ANGLES/LAYERS/CONTENT

		// VIEWS: 
			CUSTOMIZER
				TOOLBAR
					HEADER
						TITLE
					LIST
						LAYERS
							LAYER
						CHOICES
							HEADER (CLOSE + LAYER)
							CHOICE

				VIEWER
					BG
					LAYER IMAGE



	*/

	// Compatibility with Yith Added to cart popup (Premium)
	$( document ).on( 'yith_wacp_adding_cart_single', function() {
		if ( PC && PC.fe && PC.fe.modal ) {
			PC.fe.modal.$el.addClass( 'adding-to-cart' );
		}
	} );
	// 
	$( document ).on( 'yith_wacp_popup_after_opening', function() {
		if ( PC && PC.fe && PC.fe.modal ) {
			PC.fe.modal.$el.removeClass( 'adding-to-cart' );
		}
	} );	

})( jQuery, PC._us || window._ );

PC.utils = PC.utils || {
	_isTouch: function() {
		// var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/),
			var isTouch = (('ontouchstart' in window) || (navigator.msMaxTouchPoints > 0) || (navigator.maxTouchPoints));
		return isTouch;
	},
	_isMobile: function() {
		var isTouchDevice = navigator.userAgent.match(/(iPhone|iPod|iPad|Android|playbook|silk|BlackBerry|BB10|Windows Phone|Tizen|Bada|webOS|IEMobile|Opera Mini)/);
		return !! isTouchDevice;
	},
	formatMoney: function ( amount, convert ) {
		if ( 'undefined' === typeof convert ) convert = true;
		if ( convert ) {
			amount = this.maybeConvertAmountToCurrency( amount );
		}
		if ( 'undefined' === typeof accounting ) return amount;
		return accounting.formatMoney( amount, {
			precision: PC_config.lang.money_precision,
			symbol: PC_config.lang.money_symbol,
			decimal: PC_config.lang.money_decimal,
			thousand: PC_config.lang.money_thousand,
			format: PC_config.lang.money_format
		} );
	},
	maybeConvertAmountToCurrency: function( amount ) {
		// WOOCS
		if ( 'undefined' != typeof woocs_current_currency && 'undefined' != woocs_current_currency['rate'] ) {
			return amount * woocs_current_currency['rate'];
		}
		
		// WCML
		if ( 'undefined' != typeof PC.fe.config.wcml_rate && parseFloat( PC.fe.config.wcml_rate ) ) {
			return amount * parseFloat( PC.fe.config.wcml_rate );
		}
		
		// Aelia CS
		if ( 'undefined' != typeof wc_aelia_currency_switcher_params && 'undefined' != wc_aelia_currency_switcher_params.current_exchange_rate_from_base && 0 < parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base ) ) {
			return amount * parseFloat( wc_aelia_currency_switcher_params.current_exchange_rate_from_base );
		}

		// Price Based on Country
		if ( 'undefined' != typeof PC.fe.config.wcpbc_rate && parseFloat( PC.fe.config.wcpbc_rate ) ) {
			var converted = amount * parseFloat( PC.fe.config.wcpbc_rate );
			if ( PC.fe.config.wcpbc_round_nearest ) {
				converted = Math.ceil( converted / PC.fe.config.wcpbc_round_nearest ) * PC.fe.config.wcpbc_round_nearest;
			}
			return converted;
		}


		return amount;
	},
	/**
	 * Add the language filters
	 *
	 * @param {string} lang 
	 */
	 add_language_filters: function( lang ) {
		var maybe_change_name_and_description = function( attributes ) {
			if ( attributes['name_' + lang] && '' != attributes['name_' + lang].trim() ) attributes.name = attributes['name_' + lang];
			if ( attributes['description_' + lang] && '' != attributes['description_' + lang].trim() ) attributes.description = attributes['description_' + lang];
			return attributes;
		}

		wp.hooks.addFilter( 'PC.fe.configurator.layer_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.choice_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
		wp.hooks.addFilter( 'PC.fe.configurator.angle_data', 'mkl/product_configurator', maybe_change_name_and_description, 10 );
	},
	strip_html: function( html ) {
		let doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent || "";
	},

	escape_html: function(str) {
		return String(str).replace(/[&<>"']/g, s => (
		  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s]
		));
	},
	get_message_with_vars: function(template, vars) {
		return template.replace(/{{(.*?)}}/g, (_, key) => PC.utils.escape_html(vars[key.trim()] ?? ''));
	}

};