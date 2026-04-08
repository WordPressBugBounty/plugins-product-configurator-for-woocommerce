var PC = PC || {};
PC.fe = PC.fe || {};

PC.fe.views = PC.fe.views || {};
PC.options = PC.options || {};

!( function( $, _ ) {

'use strict';
/**
 * Add to cart modal view
 */
PC.fe.views.add_to_cart_modal = Backbone.View.extend({
	tagName: 'div',
	className: 'adding-to-cart--modal',
	template: wp.template( 'mkl-pc-configurator-add-to-cart--modal' ),
	initialize: function( options ) {
		this.render();
		$( document.body ).on( 'adding_to_cart', this.on_adding.bind( this ) );
		$( document.body ).on( 'added_to_cart', this.on_added.bind( this ) );
		$( document.body ).on( 'added_to_cart_with_redirection', this.on_added_with_redirection.bind( this ) );
		$( document.body ).on( 'not_added_to_cart_with_error', this.on_not_added_to_cart.bind( this ) );
	},
	events: {
		'click button.continue-shopping': 'close',
	},
	/**
	 * Add the modal to the page
	 */
	render: function() {
		this.$el.empty().append( this.template() );
		if ( PC.fe.inline ) {
			this.$el.appendTo( $( 'body' ) );
		} else {
			this.$el.appendTo( PC.fe.modal.$main_window );
		}
	},
	/**
	 * Close modal
	 */
	close: function() {
		$( document.body ).removeClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Show messages
	 */
	on_adding: function() {
		$( document.body ).addClass( 'show-add-to-cart-modal' );
		this.show_message( 'adding' );
	},
	on_added: function( event, fragments, cart_hash, button, response ) {
		this.show_message( 'added', response.messages );
	},
	on_added_with_redirection: function( e, response ) {
		this.show_message( 'added-redirect', response.messages );
	},
	on_not_added_to_cart: function( e, response ) {
		this.show_message( 'not-added', response.messages );
	},
	/**
	 * Show the notice
	 * @param {string} type 
	 * @param {string} messages
	 */
	show_message: function( type, messages ) {
		this.$el.empty().append( wp.template( 'mkl-pc-atc-' + type )( { messages: messages || '' } ) );
	}
} )
PC.fe.views.angles = Backbone.View.extend({ 
	tagName: 'div', 
	className: 'angles-select',
	template: wp.template( 'mkl-pc-configurator-angles-list' ), 
	initialize: function( options ) { 
		// this.parent = options.parent || PC.fe; 
		this.col = PC.fe.angles; 
		return this; 
	},
	events: {
		'click .change-angle--trigger': 'on_selector_click'
	},
	render: function() { 
		this.$el.append( this.template() );
		this.$list = this.$el.find( 'ul' );
		// a11y - angles are not relevant for voice over 
		this.$el.attr( 'aria-hidden', 'true' );
		this.add_all(); 
		return this.$el; 
	},
	add_all: function() {
		this.col.each( this.add_one, this ); 
		this.col.first().set( 'active', true ); 
	},
	add_one: function( model ) {
		var new_angle = new PC.fe.views.angle( { model: model } ); 
		this.$list.append( new_angle.$el ); 
	},
	on_selector_click: function(e) {
		e.preventDefault();
	}
});

PC.fe.views.angle = Backbone.View.extend({
	tagName: 'li',
	className: 'angle',
	template: wp.template( 'mkl-pc-configurator-angle-item' ), 
	initialize: function( options ) {
		// this.parent = options.parent || PC.fe; 
		this.options = options || {};
		this.render(); 
		this.listenTo( this.model, 'change active', this.activate ); 
		wp.hooks.doAction( 'PC.fe.angle_view.init', this );
		return this;
	},

	events: {
		'click a': 'change_angle'
	},
	render: function() {
		if ( this.model.get( 'class_name' ) ) {
			this.$el.addClass( this.model.get( 'class_name' ) );
		}
		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.angle_data', this.model.attributes ) ) ); 
		return this.$el; 
	},
	change_angle: function( e ) {
		e.preventDefault();
		this.model.collection.each(function(model) {
			model.set('active' , false); 
		});
		this.model.set('active', true); 
	},
	activate: function() {
		if ( this.model.get( 'active' ) ) {			
			this.$el.addClass( 'active' );
			this.$( 'a' ).attr( 'aria-pressed', 'true' );
		} else {
			this.$( 'a' ).attr( 'aria-pressed', 'false' );
			this.$el.removeClass('active');
		}

		if ( this.model.get( 'class_name' ) ) {
			PC.fe.modal.$el.toggleClass( this.model.get( 'class_name' ), this.model.get( 'active' ) );
		}
	}

});
/*
	PC.fe.views.choice
	View for a single choice in the side-bar
*/
PC.fe.views.choice = Backbone.View.extend({
	tagName: 'li',
	className: 'choice',
	template: wp.template( 'mkl-pc-configurator-choice-item' ),
	update_tippy_on_price_update: false,
	initialize: function( options ) {
		this.options = options || {};
		this.listenTo( this.model, 'change:active', this.activate );
		wp.hooks.doAction( 'PC.fe.choice.init', this );
		wp.hooks.addAction( 'PC.fe.extra_price.after.get_tax_rates', 'mkl/pc', this.on_price_update.bind( this ) );
		wp.hooks.addAction( 'PC.fe.extra_price.after.update_price', 'mkl/pc', this.on_price_update.bind( this ) );
	},
	events: {
		'mousedown > .choice-item': 'set_choice',
		'keydown > .choice-item': 'set_choice',
		'mouseenter > .choice-item': 'preload_image',
		'focus > .choice-item': 'preload_image',
		'click > button.choice-group-label': 'toggle_group',
		'keydown > button.choice-group-label': 'toggle_group_with_keyboard',
	},
	render: function() {
		/**
		 * Called after rendering the choice item in the list
		 */
		wp.hooks.doAction( 'PC.fe.configurator.choice-item.before.render', this );
		
		var data = _.extend( {
			thumbnail: this.model.get_image( 'thumbnail' ),
			disable_selection: ! this.model.get( 'available' ) && ! PC.fe.config.enable_selection_when_outofstock
		}, wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', this.model.attributes ) );
		
		// Render the template
		this.$el.html( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.template_choice_data', data ) ) );
		this.$( '> .choice-item' ).attr( 'aria-disabled', data.disable_selection ? 'true' : 'false' );

		wp.hooks.doAction( 'PC.fe.configurator.choice-item.render.after-template', this );

		if ( this.$( '.out-of-stock' ).length ) {
			this.$el.addClass( 'out-of-stock' );
		}

		if ( 'colors' == this.model.collection.layer.get( 'display_mode' ) && this.$( '.out-of-stock' ).length ) {
			if ( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).length ) {
				this.$( '.mkl-pc-thumbnail' ).append( $( '#tmpl-mkl-pc-configurator-color-out-of-stock' ).html() );
			}
		}

		var $choiceItem = this.$( '> .choice-item' );
		var description = this.get_description();
		var description_screen_reader = this.get_description( false );
		this.set_choice_sr_text( description_screen_reader );

		if ( window.tippy ) {

			/**
			 * Customization of the tooltip can be done by using TippyJS options: atomiks.github.io/tippyjs/v6/
			 */
			var tooltip_options = wp.hooks.applyFilters( 'PC.fe.tooltip.options', {
				interactive: false,
				content: description,
				allowHTML: true,
				placement: 'top',
				zIndex: 100001,
				appendTo: 'parent',
				trigger: 'mouseenter focus',
				onCreate: function( instance ) {
					if ( instance && instance.popper ) {
						instance.popper.setAttribute( 'aria-hidden', 'true' );
					}
				},
			},
			this );

			tooltip_options = wp.hooks.applyFilters( 'PC.fe.choice.tooltip.options', tooltip_options, this );

			if ( tooltip_options.content && tooltip_options.content.length && $choiceItem.length ) {
				tippy( $choiceItem[0], tooltip_options );
			}
		}

		if ( this.model.get( 'is_group' ) ) this.$el.addClass( 'is-group' );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( data.thumbnail || this.model.get( 'color' ) ) this.$el.addClass( 'has-thumbnail' );

		this.activate();
		this.$el.data( 'view', this );

		/**
		 * Called after rendering the choice item in the list
		 */
		wp.hooks.doAction( 'PC.fe.configurator.choice-item.render', this );

		return this.$el;
	}, 
	on_price_update: function() {
		if ( ! this.update_tippy_on_price_update || this.model.get( 'is_group' ) ) return;
		var $ci = this.$( '.choice-item' );
		if ( $ci.length && $ci[0] && $ci[0]._tippy ) {
			$ci[0]._tippy.setContent( this.get_description() );
		}
	},
	get_description: function( html = true) {
		var description = [];
		if ( wp.hooks.applyFilters( 'PC.fe.tooltip.add_all_text', 'colors' == this.model.collection.layer.get( 'display_mode' ) && ! this.model.get( 'is_group' ) ) ) {
			this.update_tippy_on_price_update = true;
			if ( this.$( '.choice-text' ).length ) {
				description.push( html ? this.$( '.choice-text' ).html() : this.$( '.choice-text' ).text() );
			} else if ( this.$( '.choice-name' ).length ) {
				description.push( html ? this.$( '.choice-name' ).html() : this.$( '.choice-name' ).text() );
			}
			if ( this.$( '.choice-price' ).length ) {
				description.push( html ? this.$( '.choice-price' ).html() : this.$( '.choice-price' ).text() );
				this.$( '.choice-price' ).hide();
			}
			if ( this.$( '.description' ).length ) {
				description.push( html ? this.$( '.description' ).html() : this.$( '.description' ).text() );
				this.$( '.description' ).hide();
			}
			if ( this.$( '.out-of-stock' ).length ) {
				description.push( html ? this.$( '.out-of-stock' )[0].outerHTML : this.$( '.out-of-stock' )[0].outerText );
				// console.log('get desc', this.model.collection.layer.get( 'name' ), this.model.get( 'name' ), this.$( '.out-of-stock' ).length, this.$( '.out-of-stock' )[0].outerHTML );
			}
		} else if ( ! PC.fe.config.choice_description_no_tooltip ) {
			description.push( html ? this.$( '.description' ).html() : this.$( '.description' ).text() );
		}
		// console.log( description );
		if ( html ) {
			return description.join( ' ' );
		} else {
			return description.join( ', ' );
		}
	},
	set_choice_sr_text: function( description ) {
		var $choice_item = this.$( '> .choice-item' );
		if ( ! $choice_item.length ) return;
		var details = '';
		if ( description ) {
			details = description.replace( /\s+/g, ' ' ).replace( /\s*,\s*/g, ', ' ).trim();
		}
		// var text = details ? ( name ? name + '. ' + details : details ) : name;
		if ( details ) {
			$choice_item.attr( 'aria-label', details );
		}
	},
	set_choice: function( event ) {
		if ( this.model.get( 'is_group' ) ) return;

		if ( event.type == 'keydown' ) {
			if ( event.keyCode >= 37 && event.keyCode <= 40 ) {
				event.preventDefault();
				this.navigate_choices( event.keyCode );
				return;
			}
			if ( ! ( event.keyCode == 13 || event.keyCode == 32 ) ) {
				return;
			}
		}

		if ( event.type == 'mousedown' && event.button ) return;

		// console.log( event );
		
		// If the element is disabled, exit.
		if ( $( event.currentTarget ).prop( 'disabled' ) ) return;
		// Activate the clicked item
		this.model.collection.selectChoice( this.model.id );
		var layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		var auto_close = layer.get( 'auto_close' );
		var close_choices = 
			( PC.fe.config.close_choices_when_selecting_choice && ( $( 'body' ).is('.is-mobile' ) || PC.utils._isMobile() ) )
			|| PC.fe.config.close_choices_when_selecting_choice_desktop
			|| 'dropdown' == layer.get( 'display_mode' )
			|| ( 'full-screen' == layer.get( 'display_mode' ) && 'simple' == layer.get( 'type' ) )
			|| 'yes' === auto_close;

		// If the layer contains the class no-auto-close, do not toggle
		if ( 'no' === auto_close ) close_choices = false;

		if ( layer ) {
			// Maybe close the choice list
			if ( wp.hooks.applyFilters( 'PC.fe.close_choices_after_selection', close_choices, this.model ) ) {
				layer.set( 'active', false );
			} else if ( ! layer.get( 'active' ) ) {
				// Maybe set the current layer to active
				var current = layer.collection.filter( function( item ) {
					return item.get( 'active' ) && false !== item.get( 'cshow' ) && 'group' != item.get( 'type' );
				} );
				if ( current.length ) current[0].set( 'active', false );
				layer.set( 'active', true );
			}
		}


		PC.fe.last_clicked = this;
		wp.hooks.doAction( 'PC.fe.choice.set_choice', this.model, this )
	},
	preload_image: function() {
		// console.log('preload image');
		this.model.trigger( 'preload-image' );
		// var src = this.model.get_image();
		// if ( ! src ) return;
		// var img = new Image();
		// img.src = src;
	},
	activate: function() {
		this.set_choice_a11y_attrs();
		if( this.model.get('active') === true ) {
			this.$el.addClass( 'active' );
			this.$( '> button.choice-item' ).attr( 'aria-checked', 'true' );
			wp.hooks.doAction( 'PC.fe.choice.activate', this );
		} else {
			this.$el.removeClass( 'active' );
			this.$( '> button.choice-item' ).attr( 'aria-checked', 'false' );
			wp.hooks.doAction( 'PC.fe.choice.deactivate', this );
		}
		if ( this.options.parent && this.options.parent.update_roving_tabindex ) {
			this.options.parent.update_roving_tabindex();
		}
	},
	toggle_group: function() {
		this.$el.toggleClass( 'show-group-content' );
		this.$( '> .choice-group-label' ).attr( 'aria-expanded', this.$el.is( '.show-group-content' ) ? 'true' : 'false' );
	},
	toggle_group_with_keyboard: function( event ) {
		if ( ! ( event.keyCode === 13 || event.keyCode === 32 ) ) return;
		event.preventDefault();
		this.toggle_group();
	},
	get_layer_type: function() {
		if ( this.model.collection && this.model.collection.layer ) {
			return this.model.collection.layer.get( 'type' ) || 'simple';
		}
		return 'simple';
	},
	/**
	 * Native <button> + radiogroup roving tabindex (choices.js); no duplicate native inputs in default templates.
	 */
	set_choice_a11y_attrs: function() {
		var $choice_item = this.$( '> button.choice-item' );
		if ( ! $choice_item.length ) return;
		var role = 'multiple' === this.get_layer_type() ? 'checkbox' : 'radio';
		$choice_item.attr( 'role', role );
	},
	navigate_choices: function( key_code ) {
		if ( ! this.options.parent || ! this.options.parent.$list ) return;
		var $items = PC.fe.a11y.filter_focusable( this.options.parent.$list.find( '.choice-item' ) );
		if ( ! $items.length ) return;
		var current_index = $items.index( this.$( '> .choice-item' ) );
		if ( -1 === current_index ) return;
		var direction = ( key_code === 37 || key_code === 38 ) ? -1 : 1;
		var next_index = ( current_index + direction + $items.length ) % $items.length;
		var $next = $items.eq( next_index );
		if ( ! $next.length ) return;
		PC.fe.a11y.focus_without_scroll( $next );

		if ( 'multiple' !== this.get_layer_type() ) {
			var next_view = $next.closest( 'li.choice' ).data( 'view' );
			if ( next_view && next_view.model ) {
				next_view.model.collection.selectChoice( next_view.model.id, true );
			}
		}
	}
});

PC.fe.views.choiceGroup = PC.fe.views.choice.extend({
	template: wp.template( 'mkl-pc-configurator-choice-group' ),
});

/*
	PC.fe.views.choices 
*/
PC.fe.views.choices = Backbone.View.extend({ 
	tagName: 'ul', 
	className: 'layer_choices', 
	template: wp.template( 'mkl-pc-configurator-choices' ),
	initialize: function( options ) { 
		this.options = options || {}; 
		return this.render();
	},
	events: {
		'click .choices-close': 'close_choices'
	},
	render: function() {
		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', this.model.attributes ) ) ); 
		this.$el.addClass( this.model.get( 'type' ) );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( this.model.get( 'parent' ) ) this.$el.addClass( 'is-child-layer' );
		if ( 'compact-list' != this.model.get( 'display_mode' ) && this.model.get( 'columns' ) ) this.$el.addClass( 'columns-' + this.model.get( 'columns' ) );
		if ( this.model.get( 'color_swatch_size' ) ) this.$el.addClass( 'swatches-size--' + this.model.get( 'color_swatch_size' ) );

		this.$list = this.$el.find('.choices-list ul'); 
		this.set_a11y_attributes();
		this.add_all( this.options.content ); 
		
		if ( this.options.content && ( ! this.model.get( 'default_selection' ) || 'select_first' == this.model.get( 'default_selection' ) ) && !this.options.content.findWhere( { 'active': true } ) && this.options.content.findWhere( { available: true } ) ) {
			var av = this.options.content.findWhere( { available: true } );
			if ( av ) av.set( 'active', true );
		}

		this.update_roving_tabindex();
		return this.$el;
	},
	/**
	 * Roving tabindex for simple layers (radiogroup pattern).
	 * Ensures Tab enters the group once; arrow keys move between choices.
	 */
	update_roving_tabindex: function() {
		if ( ! this.$list || ! this.$list.length ) return;
		if ( 'simple' !== ( this.model.get( 'type' ) || 'simple' ) ) return;

		var $items = PC.fe.a11y.filter_focusable( this.$list.find( '.choice-item' ) );
		if ( ! $items.length ) return;

		// Make all items untabbable by default.
		$items.attr( 'tabindex', '-1' );

		// Prefer the checked one, otherwise the first available.
		var $checked = $items.filter( '[aria-checked="true"]' ).first();
		var $target = $checked.length ? $checked : $items.first();
		$target.attr( 'tabindex', '0' );
	},
	set_a11y_attributes: function() {
		if ( ! this.$list || ! this.$list.length ) return;
		var layer_name = this.model.get( 'name' ) || '';
		var layer_type = this.model.get( 'type' ) || 'simple';
		var list_id = 'mkl-pc-choice-list-' + this.model.id;
		this.$list.attr( 'id', list_id );

		if ( 'simple' === layer_type ) {
			this.$list.attr( {
				role: 'radiogroup',
				'aria-label': layer_name
			} );
		} else if ( 'multiple' === layer_type ) {
			this.$list.attr( {
				role: 'group',
				'aria-label': layer_name
			} );
		}
	},
	add_all: function( collection ) { 
		// this.$el.empty();
		if ( 'group' == this.model.get( 'type' ) ) return;
		collection.each( this.add_one, this );
	},
	add_one: function( model ) {
		// Possibility to avoid adding choice
		if ( !wp.hooks.applyFilters( 'PC.fe.choices.add_one', true, model ) ) return;

		if ( model.get( 'is_group' ) )  {
			var new_choice = new PC.fe.views.choiceGroup( { model: model, multiple: false, parent: this } ); 
		} else {
			var new_choice = new PC.fe.views.choice( { model: model, multiple: false, parent: this } ); 
		}

		if ( model.get( 'parent' ) && this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).length ) {
			this.$( 'ul[data-item-id=' + model.get( 'parent' ) + ']' ).append( new_choice.render() ); 
		} else {
			this.$list.append( new_choice.render() ); 
		}

		/**
		 * Action hook: PC.fe.choices.add_one.after
		 * @param {PC.fe.views.choices} target_view
		 * @param {PC.fe.views.choice} new_choice
		 */
		wp.hooks.doAction( 'PC.fe.choices.add_one.after', this, new_choice );
	},
	close_choices: function( event ) {
		event.preventDefault(); 
		this.model.set('active', false);
		var $layerBtn = $( '#config-layer-' + this.model.id );
		if ( $layerBtn.length ) {
			PC.fe.a11y.focus_without_scroll( $layerBtn );
		}
	}
});

/*
	PC.fe.views.configurator 
	-> MAIN WINDOW
*/
PC.fe.views.configurator = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc',
	template: wp.template( 'mkl-pc-configurator' ), 
	initialize: function( options ) {
		this.options = options;
		this.product_id = options.product_id;
		this.parent_id = options.parent_id;
		wp.hooks.doAction( 'PC.fe.init.modal', this ); 
		
		if ( this.parent_id && 'async' !== PC.fe.config.data_mode ) {
			this.options = PC.productData['prod_' + this.parent_id].product_info; 
		} else {
			this.options = PC.productData['prod_' + this.product_id].product_info; 
		}

		try {
			this.render();
		} catch (err) {
			console.log ('There was an error when rendering the configurator: ', err);
		}
		return this; 
	},
	events: {
		'content-is-loaded': 'start',
		'click .close-mkl-pc': 'close',
	},
	focusable_selector: 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])',
	render: function() {
		if ( PC.fe.a11y.modal_focusable_selector ) {
			this.focusable_selector = PC.fe.a11y.modal_focusable_selector;
		}
		if( PC.fe.inline == true && $(PC.fe.inlineTarget).length > 0 ) {
			$(PC.fe.inlineTarget).empty().append(this.$el);
		} else if ( PC.fe.config.inline == true && $(PC.fe.config.inlineTarget).length > 0 ) {
			$(PC.fe.config.inlineTarget).append(this.$el);
			PC.fe.inline = true;
		} else {
			$('body').append(this.$el);
			PC.fe.inline = false;
		}

		if ( PC.fe.config.choice_description_no_tooltip ) {
			this.$el.addClass( 'no-tooltip' );
		}

		this.$el.append( this.template( { bg_image: wp.hooks.applyFilters( 'PC.fe.config.bg_image', PC.fe.config.bg_image, this ) } ) ); 
		this.$main_window = this.$el.find( '.mkl_pc_container' );

		if ( ! PC.fe.inline ) {
			this.$main_window.attr( {
				role: 'dialog',
				'aria-modal': 'true'
			} );
			this.$main_window.removeAttr( 'aria-label' );
		} else {
			var inlineRegionLabel = ( typeof PC_config !== 'undefined' && PC_config.lang && PC_config.lang.inline_region_aria_label ) ? PC_config.lang.inline_region_aria_label : 'Product configurator';
			this.$main_window.attr( {
				role: 'region',
				'aria-label': inlineRegionLabel
			} );
			this.$main_window.removeAttr( 'aria-modal aria-labelledby' );
		}
		if ( ! this.$main_window.find( '.mkl-pc-live-region' ).length ) {
			this.$main_window.append( '<div class="mkl-pc-live-region screen-reader-text" aria-live="polite" aria-atomic="true"></div>' );
		}
		return this.$el; 
	},
	open: function() {
		this.$el.show(); 

		setTimeout( _.bind( this.$el.addClass, this.$el, 'opened' ), 10 );

		this.previously_focused_el = document.activeElement;
		this.trigger_el = PC.fe.trigger_el;

		// Set focus on the first layer
		if ( wp.hooks.applyFilters( 'PC.fe.setup_keyboard_navigation', true ) ) {
			$( document ).on( 'keydown.mkl-pc-modal', this.handle_configurator_keydown.bind( this ) );
			if ( !PC.fe.inline ) {
				this.apply_initial_focus();
				setTimeout( this.apply_initial_focus.bind( this ), 500 );
			}
		}
		wp.hooks.doAction( 'PC.fe.open', this ); 
	},
	close: function() {
		PC.fe.opened = false; 
		// Remove classes
		this.$el.removeClass( 'opened' ); 
		$('body').removeClass('configurator_is_opened');

		// Empty the form fields to prevent adding the configuration to the cart by mistake (only if the configurator doesn't automatically close, as that would empty the field)
		if ( ! PC.fe.config.close_configurator_on_add_to_cart ) $( 'input[name=pc_configurator_data]' ).val( '' );
		$( document ).off( 'keydown.mkl-pc-modal' );

		wp.hooks.doAction( 'PC.fe.close', this ); 

		setTimeout( _.bind( this.$el.hide, this.$el ), 500 );
		if ( ! PC.fe.inline ) this.restore_focus();
	},

	start: function( e, arg ) {
		if ( this.toolbar ) this.toolbar.remove();
		if ( this.viewer ) this.viewer.remove();
		if ( this.footer ) this.footer.remove();
		const Viewer_View = wp.hooks.applyFilters( 'PC.fe.viewer.main_view', PC.fe.views.viewer );
		this.viewer = new Viewer_View( { parent: this } );
		this.$main_window.append( this.viewer.render() );
		
		if ( ! PC.fe.angles.length || ! PC.fe.layers.length || ! PC.fe.contents.content.length ) {
			var message = $( '<div class="error configurator-error" />' ).text( 'The product configuration seems incomplete. Please make sure Layers, angles and content are set.' );
			if ( ! PC.fe.config.inline ) {
				$( PC.fe.trigger_el ).after( message );
				this.close();
				PC.fe.active_product = false;
			} else {
				$( PC.fe.trigger_el ).append( message );
			}
			return;
		}

		if ( arg == 'no-content' ) {
			this.toolbar = new PC.fe.views.empty_viewer();
			this.viewer.$el.append( this.toolbar.render() );
		} else {
			this.toolbar = new PC.fe.views.toolbar( { parent: this } );
			this.footer = new PC.fe.views.footer( { parent: this } );

			this.$main_window.append( this.toolbar.render() ); 
			this.$main_window.append( this.footer.render() );
		}

		this.refresh_main_window_accessibility();

		// this.summary = new PC.fe.views.summary();
		// this.$main_window.append( this.summary.$el );

		var images = this.viewer.$el.find( 'img' ),
			imagesLoaded = 0,
			that = this;
		
		/*
		$(PC.fe).trigger( 'start.loadingimages', that ); 
		wp.hooks.doAction( 'PC.fe.start.loadingimages', that ); 
		console.log('start loading images.'); 
		this.viewer.$el.addClass('is-loading-image'); 
		images.each(function(index, el) {
			$(el).on('load', function( e ){
				imagesLoaded++; 
				if( imagesLoaded == images.length ) {
					console.log('remove loading class images');	
					that.viewer.$el.removeClass('is-loading-image');
				}					
			});
		});
		*/
		$( PC.fe ).trigger( 'start', this );
		wp.hooks.doAction( 'PC.fe.start', this ); 
		this.open();
	},
	resetConfig: function() {
		// Reset the configuration
		PC.fe.contents.content.resetConfig();

		// Maybe load the initial preset
		if ( PC.fe.initial_preset ) {
			PC.fe.setConfig( PC.fe.initial_preset );
		}
		
		// Maybe reset the view
		if ( 1 < PC.fe.angles.length ) {
			PC.fe.angles.each( function( model ) {
				model.set('active' , false); 
			} );
			PC.fe.angles.first().set( 'active', true ); 
		}

		// Trigger an action after reseting
		wp.hooks.doAction( 'PC.fe.reset_configurator' );
	},
	refresh_main_window_accessibility: function() {
		if ( ! this.$main_window || ! this.$main_window.length ) return;
		var $label = this.$el.find( '.mkl_pc_toolbar header .product-name, .product-name' ).first();
		if ( ! $label.length ) return;
		if ( ! $label.attr( 'id' ) ) {
			$label.attr( 'id', 'mkl-pc-dialog-title-' + this.product_id );
		}
		this.$main_window.attr( 'aria-labelledby', $label.attr( 'id' ) );
		var $description = this.$el.find( '.mkl_pc_toolbar #mkl-pc-dialog-instructions-' + this.product_id ).first();
		if ( $description.length ) {
			this.$main_window.attr( 'aria-describedby', $description.attr( 'id' ) );
		} else {
			this.$main_window.removeAttr( 'aria-describedby' );
		}
		if ( ! PC.fe.inline ) this.$main_window.removeAttr( 'aria-label' );
	},
	restore_focus: function() {
		if ( this.trigger_el && $( this.trigger_el ).length ) {
			PC.fe.a11y.focus_without_scroll( $( this.trigger_el ) );
			return;
		}
		if ( this.previously_focused_el && document.contains( this.previously_focused_el ) ) {
			PC.fe.a11y.focus_without_scroll( $( this.previously_focused_el ) );
		}
	},
	get_initial_focus_target: function() {
		var $scope = this.$main_window && this.$main_window.length ? this.$main_window : this.$el;
		if ( ! $scope || ! $scope.length ) return $();

		// 1) Toolbar header (tabindex -1 — valid programmatic focus target).
		var $header = $scope.find( '.mkl_pc_toolbar > header' ).first();
		if ( $header.length && $header.is( ':visible' ) ) {
			return $header;
		}

		// 2) First visible layer row: primary layer button, then choices in that layer, then nested layer buttons.
		var $first_visible_layer = $scope.find( '.layers .layers-list-item:visible:not(.hide_in_configurator)' ).first();
		if ( $first_visible_layer.length ) {
			var $first_layer_button = $first_visible_layer.find( '> button.layer-item:visible:not(:disabled)' ).first();
			if ( $first_layer_button.length && PC.fe.a11y.is_focusable_enabled( $first_layer_button ) ) {
				return $first_layer_button;
			}

			var first_layer_id = $first_visible_layer.attr( 'data-layer' );
			if ( first_layer_id ) {
				var $layerChoices = $scope.find( '#mkl-pc-layer-choices-' + first_layer_id );
				var $first_input = PC.fe.a11y.filter_focusable( $layerChoices.find( '.choice-item-input' ) ).first();
				if ( $first_input.length ) return $first_input;
				var $first_choice = PC.fe.a11y.filter_focusable( $layerChoices.find( '.choice-item' ) ).first();
				if ( $first_choice.length ) return $first_choice;
			}

			var $nested_layer_button = $first_visible_layer.find( 'button.layer-item:visible:not(:disabled)' ).first();
			if ( $nested_layer_button.length && PC.fe.a11y.is_focusable_enabled( $nested_layer_button ) ) {
				return $nested_layer_button;
			}
		}

		var $layer_button = $scope.find( '.layers .layers-list-item:visible:not(.hide_in_configurator) > button.layer-item:visible:not(:disabled)' ).first();
		if ( $layer_button.length && PC.fe.a11y.is_focusable_enabled( $layer_button ) ) return $layer_button;

		// 3) First choice in any open choices panel (inputs preferred for form-like layers).
		var $choice_input = PC.fe.a11y.filter_focusable( $scope.find( '.layer_choices:visible .choice-item-input' ) ).first();
		if ( $choice_input.length ) return $choice_input;
		var $choice_button = PC.fe.a11y.filter_focusable( $scope.find( '.layer_choices:visible .choice-item' ) ).first();
		if ( $choice_button.length ) return $choice_button;

		// 4) First generic focusable in the modal.
		var $focusable = PC.fe.a11y.filter_focusable( $scope.find( this.focusable_selector ) ).first();
		if ( $focusable.length ) return $focusable;

		return this.$main_window && this.$main_window.length ? this.$main_window : $();
	},
	
	apply_initial_focus: function() {
		if ( PC.fe.inline ) return;
		var $target = this.get_initial_focus_target();
		if ( $target && $target.length ) {
			PC.fe.a11y.focus_without_scroll( $target );
		}
	},

	/**
	 * Visible, enabled focusables (delegates to PC.fe.a11y.filter_focusable).
	 */
	filter_modal_focusable: function( $collection ) {
		return PC.fe.a11y.filter_focusable( $collection );
	},
	
	/**
	 * Tab order for drawer-style choices: all focusables inside .choices-list, then .choices-close.
	 */
	get_drawer_choices_tab_cycle: function( $layerChoices ) {
		var $listFocusable = this.filter_modal_focusable( $layerChoices.find( '.choices-list' ).first().find( this.focusable_selector ) );
		var $close = $layerChoices.find( '.choices-close' ).filter( ':visible' );
		var cycle = [];
		$listFocusable.each( function() {
			cycle.push( this );
		} );
		if ( $close.length ) {
			cycle.push( $close[0] );
		}
		return cycle;
	},
	handle_configurator_keydown: function( event ) {
		if ( ! this.$el.is( ':visible' ) ) return;
		if ( 'Escape' === event.key ) {
			// Nested SYD/Share modals handle Escape themselves.
			if ( $( 'body' ).hasClass( 'syd-modal-opened' ) || $( 'body' ).hasClass( 'syd-share-modal-opened' ) ) {
				return;
			}
			if ( $( 'body' ).hasClass( 'mkl-pc-showing-advanced-description' ) || $( '.mkl-pc-advanced-description--container' ).length ) {
				return;
			}
			var $activeLayer = this.$main_window.find( '.layers .layers-list-item.active:visible:not(.hide_in_configurator)' ).first();
			if ( $activeLayer.length ) {
				var activeLayerView = $activeLayer.data( 'view' );
				if ( activeLayerView && activeLayerView.choices_location && 'in' !== activeLayerView.choices_location ) {
					var $focusTarget = activeLayerView.$( '> button.layer-item:visible:not(:disabled)' ).first();
					if ( ! $focusTarget.length ) {
						$focusTarget = this.$main_window;
					}
					activeLayerView.show_choices( null );
					event.preventDefault();
					setTimeout( function() {
						PC.fe.a11y.focus_without_scroll( $focusTarget );
					}, 0 );
					return;
				}
			}
			if ( PC.fe.inline ) return;
			event.preventDefault();
			this.close();
			return;
		}
		if ( 'Tab' !== event.key ) return;

		var activeEl = document.activeElement;
		var $layerChoices = $( activeEl ).closest( '.layer_choices.active' );
		if ( $layerChoices.length ) {
			var choicesId = $layerChoices.attr( 'id' ) || '';
			var layerIdMatch = choicesId.match( /^mkl-pc-layer-choices-(.+)$/ );
			var layerView = null;
			if ( layerIdMatch ) {
				var $layerLi = this.$main_window.find( '.layers .layers-list-item[data-layer="' + layerIdMatch[1] + '"]' ).first();
				layerView = $layerLi.data( 'view' );
			}
			if ( layerView && layerView.choices_location && 'in' !== layerView.choices_location ) {
				var cycle = this.get_drawer_choices_tab_cycle( $layerChoices );
				if ( cycle.length ) {
					var idx = cycle.indexOf( activeEl );
					if ( idx !== -1 ) {
						event.preventDefault();
						var next;
						if ( event.shiftKey ) {
							next = idx === 0 ? cycle[ cycle.length - 1 ] : cycle[ idx - 1 ];
						} else {
							next = idx === cycle.length - 1 ? cycle[0] : cycle[ idx + 1 ];
						}
						PC.fe.a11y.focus_without_scroll( $( next ) );
						return;
					}
				}
			}
		}

		if ( PC.fe.inline ) return;

		// Focus cycling
		var $focusable = PC.fe.a11y.filter_focusable( this.$main_window.find( this.focusable_selector ) );
		if ( ! $focusable.length ) return;
		var first = $focusable[0];
		var last = $focusable[ $focusable.length - 1 ];
		if ( event.shiftKey && document.activeElement === first ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( last ) );
		} else if ( ! event.shiftKey && document.activeElement === last ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( first ) );
		}
	}
});

PC.fe.views.empty_viewer = Backbone.View.extend({
	tagName: 'div', 
	className: 'nothing-selected',
	template: wp.template( 'mkl-pc-configurator-empty-viewer' ), 
	initialize: function( options ) { 
		return this; 
	},
	render: function() { 
		this.$el.append( this.template() );
		return this.$el; 
	},
});

/*
	PC.fe.views.footer 
*/
PC.fe.views.footer = Backbone.View.extend({
	tagName: 'footer', 
	className: 'mkl_pc_footer', 
	template: wp.template( 'mkl-pc-configurator-footer' ),
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		return this; 
	},

	events: {
		'click .reset-configuration': 'reset_configurator',
	},

	render: function() {
		this.$el.append( this.template( {
			name: PC.fe.currentProductData.product_info.title,
			show_form: parseInt( PC.fe.config.show_form ) || ! $( 'form.cart' ).length || PC.fe.currentProductData.product_info.force_form,
			is_in_stock: parseInt( PC.fe.currentProductData.product_info.is_in_stock ),
			product_id: parseInt( PC.fe.active_product ),
			show_qty: parseInt( PC.fe.currentProductData.product_info.show_qty ),
			formated_price: this.get_price(),
			formated_regular_price: ( PC.fe.currentProductData.product_info.is_on_sale && PC.fe.currentProductData.product_info.regular_price ) ? PC.utils.formatMoney( parseFloat( PC.fe.currentProductData.product_info.regular_price ) ) : false,
		} ) );
		this.form = new PC.fe.views.form( { el: this.$( '.form' ) } );
		return this.$el; 
	},

	reset_configurator: function( event ) {
		PC.fe.modal.resetConfig();
		PC.fe.save_data.reset_errors();
	},

	get_price: function() {
		if ( ! PC.fe.currentProductData.product_info.price ) return false;
		return PC.utils.formatMoney( parseFloat( PC.fe.currentProductData.product_info.price ) );
	}
});

/*
	PC.fe.views.form
*/
PC.fe.views.form = Backbone.View.extend({
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		$( document.body ).on( 'added_to_cart', this.on_added_to_cart.bind( this ) );
		this.render();
		return this; 
	},
	events: {
		'click .configurator-add-to-cart': 'add_to_cart',
		'click .add-to-quote': 'add_to_quote',
		'change input.qty': 'qty_change'
	},
	render: function() {
		if ( ! PC.fe.config.cart_item_key ) {
			this.$( '.edit-cart-item' ).hide();
		} else if ( PC.fe.config.cart_item_key && this.$( '.edit-cart-item' ).length ) { 
			this.$el.addClass( 'edit-cart-item-is-displayed');
		}

		if ( 'variable' === PC.fe.product_type || 'variation' === PC.fe.product_type ) {
			var atc = $( '[name=variation_id][value=' + PC.fe.active_product + ']' );
			if ( ! atc.length ) atc = $( '[name=add-to-cart][value=' + PC.fe.active_product + ']' );
		} else {
			var atc = $( '[name=add-to-cart][value=' + PC.fe.active_product + ']' );
		}

		var input = this.$( 'input[name=pc_configurator_data]' );

		if ( ! input.length && ! atc.length ) return;

		if ( input.length ) {
			// Get the input
			this.$input = input.first();
			// The cart must be the one containing the input
			this.$cart = this.$input.closest( 'form.cart' );
		} else {
			this.$input = atc.closest( 'form.cart' ).find( 'input[name=pc_configurator_data]' ).first();
			this.$cart = this.$input.closest( 'form.cart' );
		}

		// If the input isn't in the page, check in this view
		// if ( ! this.$input.length || PC.fe.currentProductData.product_info.force_form ) this.$input = this.$( 'input[name=pc_configurator_data]' );

		if ( ! this.$cart.find( '[name=add-to-cart]' ).length ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}
		
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length && ! $( '.add-request-quote-button' ).length ) {
			this.$( '.add-to-quote' ).remove();
		}
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).html( this.$cart.find( '.afrfqbt_single_page' ).html() );
		}
		if ( $( '.add-request-quote-button' ).length && PC_config.config.ywraq_hide_add_to_cart ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}

		if ( this.$( 'input.qty' ).length ) {
			// Get qty with the Cart's input
			if ( this.$( 'input.qty' ) != this.$cart.find( '.qty' ) ) {
				this.$( 'input.qty' ).val( this.$cart.find( '.qty' ).val() );
			}
			// Set min value
			if ( 'undefined' != typeof PC.fe.currentProductData.product_info.qty_min_value ) {
				this.$( 'input.qty' ).prop( 'min', PC.fe.currentProductData.product_info.qty_min_value );
			}
			// Set max value
			if ( 'undefined' != typeof PC.fe.currentProductData.product_info.qty_max_value ) {
				this.$( 'input.qty' ).prop( 'max', PC.fe.currentProductData.product_info.qty_max_value );
			}
		}

		wp.hooks.doAction( 'PC.fe.render_form', this );
		return this.$el;
	},

	validate_configuration: function() {
		var data = PC.fe.save_data.save();
		var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
		if ( errors.length ) {
			if ( PC.fe.show_validation_errors ) {
				PC.fe.show_validation_errors( errors );
			}
			return false;
		}
		if ( PC.fe.clear_validation_errors ) {
			PC.fe.clear_validation_errors();
		}
		return data;
	},
	
	populate_form_input: function( data, e ) {

		if ( PC.fe.config.cart_item_key && $( e.currentTarget ).is( '.edit-cart-item' ) ) {
			var $cart_item_field = this.$cart.find( 'input[name=pc_cart_item_key]' );
			if ( $cart_item_field ) $cart_item_field.val( PC.fe.config.cart_item_key );
		}

		$( 'input[name=pc_configurator_data]' ).val( data );
	},

	add_to_cart: function( e ) {

		var data = this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
		}

		wp.hooks.doAction( 'PC.fe.add_to_cart.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data after', data );
			return;
		}

		/**
		 * Filter PC.fe.trigger_add_to_cart: Will submit the form only returns true
		 *
		 * @param boolean should_submit
		 * @param object  $cart - The jQuery object
		 */
		if ( wp.hooks.applyFilters( 'PC.fe.trigger_add_to_cart', true, this.$cart ) ) {

			$( e.currentTarget ).addClass( 'adding-to-cart' );

			var btn;
			if ( this.$cart?.find( 'button[name=add-to-cart]' ).length ) {
				btn = this.$cart.find( 'button[name=add-to-cart]' );
			} else if ( this.$cart?.find( '.single_add_to_cart_button' ).length ) {
				btn = this.$cart.find( '.single_add_to_cart_button' );
			}

			if ( PC_config.config.enable_configurator_ajax_add_to_cart ) {

				if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();

				/*
					Prepare data 
				*/
				// if ( this.$cart.find( '[name="add-to-cart"]' ).length ) {
					// var request_body = new FormData( this.$cart[0], this.$cart.find( '[name="add-to-cart"]' )[0] );
				// } else {
				// }
				var request_body = new FormData( this.$cart[0] );

				// Remove 'add-to-cart' to prevent triggering default WC's actions
				request_body.delete( 'add-to-cart' );

				var data = {
					product_id: PC.fe.active_product,
					mkl_pc_ajax: 1
				};
				if ( btn ) {
					$.each( btn.data(), function( key, value ) {
						data[ key ] = value;
					});
		
					// Fetch data attributes in $thisbutton. Give preference to data-attributes because they can be directly modified by javascript
					// while `.data` are jquery specific memory stores.
					$.each( btn[0].dataset, function( key, value ) {
						data[ key ] = value;
					});

				}
				
				$( document.body ).trigger( 'adding_to_cart', [ btn, data ] );

				$.each( data, function( key, value ) {
					if ( ! request_body.has( key ) ) {
						request_body.append( key, value );
					}
				});

				/* 
					Add to cart request
				*/
				fetch(
					wc_add_to_cart_params.ajax_url + '?action=pc_add_to_cart', {
						method: 'POST',
						body: request_body
					}
				)
				.then( response => response.json() )
				.then( data => {

					if ( data.error ) {
						if ( data.product_url ) {
							window.location = data.product_url;
							return;
						}

						$( document.body ).trigger( 'not_added_to_cart_with_error', [ data ] );
						return;
					}

					// Redirect to cart option
					if ( 'yes' === wp.hooks.applyFilters( 'PC.fe.cart_redirect_after_add', wc_add_to_cart_params.cart_redirect_after_add ) ) {
						$( document.body ).trigger( 'added_to_cart_with_redirection', [ data ] );
						window.location = wp.hooks.applyFilters( 'PC.fe.cart_redirect_url', wc_add_to_cart_params.cart_url );
						return;
					}
					
					$( document.body ).trigger( 'added_to_cart', [ data.fragments, data.cart_hash, btn, data] );
					if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
				} )
				.catch( error => {
					console.error( 'Configurator: Error in form submission' );
					console.error( error );
				} );

				return;
			}

			$( document.body ).one( 'adding_to_cart', this.on_adding_to_cart );

			if ( btn ) {
				if ( btn.is( '.ajax_add_to_cart' ) ) {
					btn.data( 'pc_configurator_data', data );
					// Edit item in the cart
					if ( btn.is( '.edit-cart-item' ) ) {
						btn.data( 'pc_cart_item_key', PC.fe.config.cart_item_key );
					}
				}
				btn.trigger( 'click' );
			} else {
				this.$cart.trigger( 'submit' );
			}
		}

		if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
	},

	/**
	 * Add compatibility with Ajax Add to cart 
	 * @param {*} e       Event
	 * @param {*} $button button object
	 * @param {*} data    The data sent
	 */
	on_adding_to_cart: function( e, $button, data ) {
		PC.fe.modal.$el.addClass( 'adding-to-cart' );
		if ( 'object' == typeof data && ! data.pc_configurator_data ) {
			data.pc_configurator_data = $( 'input[name=pc_configurator_data]' ).val();
		}

		if ( 'string' == typeof data && -1 == data.search( 'pc_configurator_data' ) ) {
			data += '&pc_configurator_data=' + $( 'input[name=pc_configurator_data]' ).val();
		}
	},

	/**
	 * Add compatibility with Ajax Add to cart - Remove adding to cart class
	 * @param {*} e         Event
	 * @param {*} fragments Cart fragments
	 * @param {*} cart_hash Cart hash
	 * @param {*} $button   button object
	 */
	on_added_to_cart: function( e, fragments, cart_hash, $button ) {
		PC.fe.modal.$el.removeClass( 'adding-to-cart' );
	},
	
	add_to_quote: function( e ) {

		var data = this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		wp.hooks.doAction( 'PC.fe.add_to_quote.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
			return;
		}

		// Woocommerce Add To Quote plugin
		if ( $( '.afrfqbt_single_page' ).length ) {
			$( '.afrfqbt_single_page' ).trigger( 'click' );
			if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
		}

		if ( $( e.currentTarget ).is( '.yith-raq' ) ) {
			$( '.add-request-quote-button' ).trigger( 'click' );
			if ( ! PC.fe.inline ) PC.fe.modal.close();
			if ( PC_config.config.ywraq_hide_add_to_cart ) {
				if ( 'button' === PC.fe.trigger_el[0].type ) $( PC.fe.trigger_el[0] ).remove();
			}
		}
	},
	qty_change: function( e ) {
		
		PC.fe.currentProductData.product_info.qty = $( e.target ).val();
		console.log( 'qty_change', PC.fe.currentProductData.product_info.qty, typeof pc_get_extra_price );
		// If Extra price is not installed, check if price needs an update
		if ( 'undefined' === typeof pc_get_extra_price && PC.fe.currentProductData.product_info?.price_tiers ) {
			$( '.pc-total-price' ).html( PC.utils.formatMoney( PC.fe.get_product_price() ) );
			// Display regular price
			if ( PC.fe.currentProductData.product_info.regular_price && PC.fe.currentProductData.product_info.is_on_sale && $( '.pc-total--regular-price' ).length ) {
				$( '.pc-total--regular-price' ).html( PC.utils.formatMoney( ( parseFloat( PC.fe.currentProductData.product_info.regular_price ) ) ) );
			}
		}
		wp.hooks.doAction( 'PC.fe.qty_changed', PC.fe.currentProductData.product_info.qty );
	}
} );

PC.fe.views.layers_list_item_selection = Backbone.View.extend({
	tagName: 'span',
	className: 'selected-choice',
	initialize: function() {
		this._last_announced_summary = null;
		this.choices = PC.fe.getLayerContent( this.model.id );
		if ( ! this.choices && 'group' !== this.model.get( 'type' ) ) return;
		this.listenTo( this.model, 'change:cshow', this.render );
		this.listenTo( this.choices, 'change:active change:cshow', this.render );
		if ( 'group' == this.model.get( 'type' ) && PC.fe.layers ) {
			this.children_layers = PC.fe.layers.where( { 'parent': this.model.id  } );
			if ( this.children_layers.length ) {
				_.each( this.children_layers, function( l ) {
					var c_choices = PC.fe.getLayerContent( l.id );
					this.listenTo( c_choices, 'change:active change:cshow', this.render );
					this.listenTo( l, 'change:cshow', this.render );
				}.bind( this ) );
			}
		}
		this.render();
	},
	render: function( changed_model ) {
		var choices_names = [];
		if ( this.choices ) {
			var active_choices = this.choices.where( { active: true } );
				_.each( active_choices, function( item ) {
				var name = item.get_name();
				if ( item.get( 'parent' ) && item.collection.get( item.get( 'parent' ) ) ) {
					var parent = item.collection.get( item.get( 'parent' ) );
					if ( parent.get( 'show_group_label_in_cart' ) ) {
						name = parent.get_name() + ' - ' + name;
					}
				}
				if ( this.should_display( item ) ) choices_names.push( wp.hooks.applyFilters( 'PC.fe.selected_choice.name', name, item ) );
			}.bind( this ) );
		}

		if ( this.children_layers && this.children_layers.length ) {
			_.each( this.children_layers, function( l ) {
				var c_choices = PC.fe.getLayerContent( l.id );
				if ( c_choices ) {
					var active_child_choices = c_choices.where( { active: true } );
					_.each( active_child_choices, function( item ) {
						var name = item.get_name();
						if ( item.get( 'parent' ) && item.collection.get( item.get( 'parent' ) ) ) {
							var parent = item.collection.get( item.get( 'parent' ) );
							if ( parent.get( 'show_group_label_in_cart' ) ) {
								name = parent.get_name() + ' - ' + name;
							}
						}
						if ( this.should_display( item ) ) {
							choices_names.push( 
								/**
								 * Filter PC.fe.selected_choice.name - Filters the selected choice name
								 * @param string name - The name
								 * @param object item - Choice model
								 * @return string
								 */
								wp.hooks.applyFilters( 'PC.fe.selected_choice.name', name, item ) 
							);
						}
					}.bind( this ) );
				}
			}.bind( this ) );
		}

		var visible_value = choices_names.join( ', ' );
		var selected_prefix = PC_config.lang.selected_prefix || 'Selected: %s';
		var selected_none = PC_config.lang.selected_none || 'Selected: none';
		var sr_value = choices_names.length ? selected_prefix.replace( '%s', visible_value ) : selected_none;
		this.$el
			.attr( 'role', 'status' )
			.attr( 'aria-live', 'polite' )
			.attr( 'aria-atomic', 'true' );
		this.$el.html(
			'<span aria-hidden="true">' + visible_value + '</span>' +
			'<span class="screen-reader-text">' + sr_value + '</span>'
		);
		wp.hooks.doAction( 'PC.fe.set.selected_choice', choices_names, this );
	},
	should_display: function( model ) {
		if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.item_is_hidden && PC.conditionalLogic.item_is_hidden( model ) ) return false;
		return true;
	}
} );

PC.fe.views.layers_list_item_selection_image = Backbone.View.extend({
	tagName: 'i',
	className: 'selected-choice-image',
	initialize: function( options ) {
		this.choices = PC.fe.getLayerContent( this.model.id );
		this.parent = options.parent;
		if ( ! this.choices ) return;
		this.listenTo( this.choices, 'change:active', this.render );
		this.has_thumbnail = this.parent.$el.is( '.has-thumbnail' );
		this.render();
	},
	render: function( choice_model, activated ) {
		var active_choices = this.choices.where( { active: true } );
		var html_content = '';
		_.each( active_choices, function( item ) {
			var image = item.get_image( 'thumbnail' );
			if ( image ) {
				html_content += '<img src="' + image + '" alt="" aria-hidden="true">';
			}
		} );
		if ( ! this.has_thumbnail ) {
			this.parent.$el.toggleClass( 'has-thumbnail', !! html_content );
		}
		this.$el.html( html_content );
	}		
} );
/*
	PC.fe.views.layer 
*/
PC.fe.views.layers_list_item = Backbone.View.extend({
	tagName: 'li',
	className: 'layers-list-item',
	template: wp.template( 'mkl-pc-configurator-layer-item' ),
	initialize: function( options ) {
		this.options = options || {};
		this.layer_type = this.model.get( 'type' );
		this.listenTo( this.options.model, 'change:active', this.activate );
		this.listenTo( this.options.model, 'activate_layer', this.on_activate_layer );
		this.listenTo( this.options.model, 'change:hide_in_configurator', this.hide_in_configurator );
		wp.hooks.doAction( 'PC.fe.layers_list_item.init', this );
	},

	events: {
		'click > button.layer-item': 'on_click_layer', 
	},

	render: function() {

		this.$el.attr( 'data-layer', this.model.id );
		this.$el.data( 'view', this );

		if ( this.model.get( 'not_a_choice' ) && this.model.get( 'custom_html' ) ) {
			const custom_html = this.model.get( 'custom_html' );
			this.$el.addClass( 'not-a-choice custom' );
			let html;
			try {	
				html = $( custom_html );
			} catch ( error ) {
				console.log( 'custom_html not formatted correctly, attempting to wrap it' );
				try {
					html = $( '<div>' + custom_html + '</div>' );
				} catch ( error ) {
					console.log( 'custom_html not formatted correctly, wrapping did not work' );
				}
			}
			if ( html.length ) this.$el.append( html );
			if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
			wp.hooks.doAction( 'PC.fe.layer.render', this );
			wp.hooks.doAction( 'PC.fe.html_layer.render', this );
			return this.$el;
		}

		var data = this.model.attributes;
		var layer_image = this.model.get( 'image' );

		this.$el.append( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', data ) ) ); 

		var layer_name_id = 'config-layer-name-' + this.model.id;
		this.$( '.layer-item .layer-name' ).first().attr( 'id', layer_name_id );
		this.$el.attr( 'aria-describedby', 'config-layer-' + this.model.id );
		this.$( '> button.layer-item' ).attr( {
			'aria-labelledby': layer_name_id,
			'aria-expanded': 'false'
		} );

		if ( PC.fe.config.show_active_choice_in_layer && ! this.model.get( 'is_step' ) ) {
			var selection = new PC.fe.views.layers_list_item_selection( { model: this.options.model } );
			this.$( '.layer-item .layer-name' ).after( selection.$el );
			var selected_choice_id = 'config-layer-selected-' + this.model.id;
			selection.$el.attr( 'id', selected_choice_id );
			this.$( '> button.layer-item' ).attr( 'aria-describedby', selected_choice_id );
		}

		// Add classes
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( this.model.get( 'display_mode' ) ) this.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
		if ( this.layer_type ) this.$el.addClass( 'type-' + this.layer_type );
		if ( this.model.get( 'is_step' ) ) this.$el.addClass( 'type-step' );
		if ( layer_image && layer_image.url ) this.$el.addClass( 'has-thumbnail' );

		if ( PC.fe.config.show_active_choice_image_in_layer && ! this.model.get( 'is_step' ) ) {
			var selection = new PC.fe.views.layers_list_item_selection_image( { model: this.options.model, parent: this } );
			this.$( '.layer-item' ).prepend( selection.$el );
		}

		this.hide_in_configurator( this.model, this.model.get( 'hide_in_configurator' ) );

		// Add ID
		if ( this.model.get( 'html_id' ) ) this.el.id = this.model.get( 'html_id' );

		if ( 'dropdown' == this.model.get( 'display_mode' ) && this.model.get( 'class_name' ) && -1 !== this.model.get( 'class_name' ).search( 'dropdown-move-label-outside' ) ) {
			this.$( '.layer-name' ).prependTo( this.$el );
		}

		this.set_accessibility_context();

		wp.hooks.doAction( 'PC.fe.layer.beforeRenderChoices', this );
		// Add the choices
		this.add_choices();

		if ( this.choices_location === 'in' ) {
			this.$el.attr( 'aria-role', 'group' );
			this.$el.attr( 'aria-labelledby', 'config-layer-name-' + this.model.id );
		}

		wp.hooks.doAction( 'PC.fe.layer.render', this );
		
		// Add display-mode class to the choices element
		if ( this.choices && this.choices.$el && this.model.get( 'display_mode' ) ) this.choices.$el.addClass( 'display-mode-' + this.model.get( 'display_mode' ) );
		return this.$el;
	},
	set_accessibility_context: function() {
		var $layer_button = this.$( '> button.layer-item' );
		if ( ! $layer_button.length ) return;
		var layer_name_id = 'config-layer-name-' + this.model.id;
		var label_ids = [ layer_name_id ];
		if ( this.model.get( 'parent' ) ) {
			var parent_id = 'config-layer-' + this.model.get( 'parent' );
			if ( this.$el.closest( '.mkl_pc' ).find( '#' + parent_id ).length ) {
				label_ids.unshift( parent_id );
			}
		}
		$layer_button.attr( 'aria-labelledby', label_ids.join( ' ' ) );
	},
	add_choices: function() {

		if ( ! this.layer_type || 'simple' == this.layer_type || 'group' == this.layer_type ) {
			this.choices = new PC.fe.views.choices({ content: PC.fe.getLayerContent( this.model.id ), model: this.model }); 
		}

		if ( ! this.choices ) {
			console.log( 'Product Configurator: No choice view was rendered.' );
			return;
		}

		var where = PC.fe.config.where;
		if ( this.model.get( 'parent' ) ) {
			var parent = this.model.collection.get( this.model.get( 'parent' ) );
			if ( parent && 'group' === parent.get( 'type' ) && ! parent.get( 'is_step' ) ) {
				where = 'in';
			}
		}

		if ( this.model.get( 'is_step' ) ) {
			where = 'in';
		}

		where = wp.hooks.applyFilters( 'PC.fe.choices.where', where, this );
		

		if( ! where || 'out' == where ) {
			this.options.parent.after( this.choices.$el );
		} else if( 'in' == where ) {
			this.$el.append( this.choices.$el ); 
		} else if ( $( where ).length ) {
			this.choices.$el.appendTo( $( where ) )
		}
		
		this.choices_location = where;

		wp.hooks.doAction( 'PC.fe.add.choices', this.choices.$el, this );
		var layer_id = 'mkl-pc-layer-choices-' + this.model.id;
		this.choices.$el.attr( 'id', layer_id );
		this.$( '> button.layer-item' ).attr( 'aria-controls', layer_id );
	},
	on_click_layer( event ) {
		if ( event ) {
			// Allow clicking on link tags
			if ( event.target.tagName && 'A' == event.target.tagName || $( event.target ).closest( 'a' ).length ) {
				return;
			}
			event.stopPropagation();
			event.preventDefault();
		}
		this.show_choices( event );
	},
	// Used for external activation
	on_activate_layer( force_activation ) {
		this.show_choices( null, force_activation );
	},
	/**
	 * show_choices handles activating and deactivating the layer and its siblings, 
	 * taking into account the layer type / display type,
	 * such as dropdowns or Steps
	 */
	show_choices: function ( event, force_activation ) {
		if ( this.model.get( 'active' ) == true ) {
			wp.hooks.doAction( 'PC.fe.layer.hide', this );
			if ( wp.hooks.applyFilters( 'PC.fe.layer.self_hide', true, this ) ) {
				this.model.set( 'active', false );
			}
		} else {
			if ( ! this.model.get( 'parent' ) || ( this.model.get( 'parent' ) && this.model.collection.get( this.model.get( 'parent' ) ) && 'group' !== this.model.collection.get( this.model.get( 'parent' ) ).get( 'type' ) ) ) {
				this.model.collection.each( function( model ) {
					model.set( 'active' , false );
				});
			} else {
				var parent = this.model.collection.get( this.model.get( 'parent' ) );
				if ( PC_config.config.auto_close_siblings_in_groups || ( parent && parent.get( 'is_step' ) ) ) {
					// Toggle any siblings
					_.each( this.model.collection.where( { 'parent': this.model.get( 'parent' ) } ), function( model ) {
						model.set( 'active' , false );
					} );
						
				}
				// Toggle any dropdowns
				_.each( this.model.collection.where( { 'display_mode': 'dropdown' } ), function( model ) {
					model.set( 'active' , false );
				} );
			}

			if ( event && 'dropdown' === this.model.get( 'display_mode' ) && 'group' !== this.model.get( 'type' ) ) {
				$( document ).on( 'click.mkl-pc', this.dropdown_click_outside.bind( this ) );
			}

			
			this.model.set( 'active', true );

			// // If the choices are not in the layer, focus the first choice
			// console.log( this.choices_location );
			
			// if ( this.choices_location !== 'in' ) {
			// 	this.choices.$( '.choice-item:visible' ).first().trigger( 'focus' );
			// }
			
			PC.fe.current_layer = this.model;
			wp.hooks.doAction( 'PC.fe.layer.show', this );
		}
	},
	dropdown_click_outside: function( event ) {
		if ( ! $( event.target ).closest( '.display-mode-dropdown.active' ).length && this.model.get( 'active' ) ) {
			this.show_choices();
		}
	},
	activate: function () {
		
		if ( this.model.get( 'active' ) ) {
			this.$el.addClass( 'active' ); 
			if ( this.choices ) {
				this.choices.$el.addClass( 'active' );

				// Autofocus first control after panel transition (steps / mouse: skip).
				if ( ! this.model.get( 'is_step' ) && PC.fe.keyboard_navigation ) {
					var $scope = this.choices.$el;
					if ( $scope && $scope.length ) {
						var view = this;
						PC.fe.a11y.focus_after_panel_transition( $scope, function() {
							if ( ! view.model.get( 'active' ) ) return;
							PC.fe.a11y.focus_first_in_scope( $scope );
						}, { namespace: 'mklPcFocus' } );
					}
				}
			}
			this.$( '> button.layer-item' ).attr( 'aria-expanded', 'true' );
			wp.hooks.doAction( 'PC.fe.layer.activate', this );
		} else {
			var active_el = document.activeElement;
			var focus_was_inside_choices = !! ( this.choices && this.choices.el && active_el && this.choices.el.contains( active_el ) );
			this.$el.removeClass( 'active' );
			if ( this.choices ) this.choices.$el.removeClass( 'active' );
			$( document ).off( 'click.mkl-pc' );
			this.$( '> button.layer-item' ).attr( 'aria-expanded', 'false' );
			// If the layer collapsed while focus was inside its choices,
			// restore focus to the layer button to avoid Safari tabbing out of the modal.
			if ( focus_was_inside_choices ) {
				setTimeout( () => {
					var $btn = this.$( '> button.layer-item:visible:not(:disabled)' ).first();
					if ( $btn.length ) {
						PC.fe.a11y.focus_without_scroll( $btn );
					} else if ( PC.fe.modal && PC.fe.modal.$main_window && PC.fe.modal.$main_window.length ) {
						PC.fe.a11y.focus_without_scroll( PC.fe.modal.$main_window );
					}
				}, 0 );
			}
			wp.hooks.doAction( 'PC.fe.layer.deactivate', this );
		}
	},
	hide_in_configurator: function( model, should_hide ) {
		this.$el.toggleClass( 'hide_in_configurator', !! should_hide );
	},
} );

/*
	PC.fe.views.layers 
*/
PC.fe.views.layers_list = Backbone.View.extend({
	// template: wp.template( 'mkl-pc-configurator-viewer' ),
	tagName: 'ul',
	className: 'layers',
	initialize: function( options ) {
		this.options = options || {}; 
		this.render();
		this.listenTo( PC.fe.layers, 'change active', this.activate );
	},
	events: {
	}, 
	render: function() {
		this.options.parent.$selection.append( this.$el );
		if ( PC_config.lang.layers_aria_label ) {
			this.$el.attr( 'aria-label', PC_config.lang.layers_aria_label );
		}
		this.add_all( PC.fe.layers );
		return this.$el;
	},
	add_all: function( collection ) { 
		this.$el.empty();
		this.items = [];
		collection.orderBy = 'order';
		collection.sort();
		if ( PC_config.config.use_steps ) PC.fe.steps.setup_steps();
		collection.each( this.add_one, this );
		wp.hooks.doAction( 'PC.fe.layers_list.layers.added', this );
	},
	add_one: function( model ) {
		var new_layer;

		if ( 'summary' == model.get( 'type' ) ) {
			new_layer = new PC.fe.views.summary( { model: model, parent: this.$el } ); 
		} else if ( ! model.attributes.not_a_choice ) {
			var choices = PC.fe.getLayerContent( model.id ); 
			if ( choices.length || 'group' == model.get( 'type' ) ) {
				new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } ); 
			}
		} else {
			if ( model.get( 'custom_html' ) ) {
				new_layer = new PC.fe.views.layers_list_item( { model: model, parent: this.$el } );
			}
		}

		if ( ! new_layer ) return;

		var parent_id = model.get( 'parent' );
		var parent = parent_id ? model.collection.get( model.get( 'parent' ) ) : false;
		if ( parent && 'group' == parent.get( 'type' ) && this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).length ) {
			this.options.parent.$( 'ul[data-layer-id=' + model.get( 'parent' ) + ']' ).append( new_layer.render() ); 
		} else {
			this.$el.append( new_layer.render() );
		}

		// add to a new collection to be used to render the viewer
		this.items.push( new_layer );
	},
	activate: function( model ) {
		if ( model.get( 'active' ) == false ) {
			if ( model.collection.findWhere( { 'active': true } ) ) {
				this.$el.addClass( 'opened' );
				wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
			} else {
				this.$el.removeClass( 'opened' );
				wp.hooks.doAction( 'PC.fe.layers_list.close', this, model );
			}
		} else {
			this.$el.addClass( 'opened' );
			wp.hooks.doAction( 'PC.fe.layers_list.open', this, model );
		}
	},

});
PC.fe.validation = PC.fe.validation || {};
PC.fe.validation.errors = PC.fe.validation.errors || [];
PC.fe.errors = PC.fe.validation.errors;

PC.fe.save_data = {
	choices: [],
	save: function( reset_errors ) {
		if ( false !== reset_errors ) this.reset_errors();
		this.choices = [];
		PC.fe.layers.each( this.parse_choices, this ); 
		this.choices = wp.hooks.applyFilters( 'PC.fe.save_data.choices', this.choices );
		return JSON.stringify( this.choices );
	},
	get_choices: function( reset_errors ) {
		this.save( reset_errors );
		return this.choices;
	},
	reset_errors: function() {
		var errs = PC.fe.validation.errors;
		if ( errs.length ) {
			_.each( errs, function( error ) {
				if ( error.choice && error.choice.get( 'has_error' ) ) {
					error.choice.set( 'has_error', false );
				}
				if ( error.layer && error.layer.get( 'has_error' ) ) {
					error.layer.set( 'has_error', false );
				}
			} );
		}
		errs.length = 0;
		var $summary = $( '.mkl-pc-validation-summary' ).first();
		if ( $summary.length ) {
			$summary.empty().attr( 'hidden', 'hidden' );
		}
		if ( PC.fe.validation.detach_live_sync ) {
			PC.fe.validation.detach_live_sync();
		}
	},
	is_layer_valid: function( layer ) {
		this.reset_errors();
		this.validate_layer( layer );
		return ! PC.fe.validation.errors.length;
	},
	validate_layer: function( layer ) {
		if ( 'group' == layer.get( 'type' ) ) {
			var children = layer.collection.where( { parent: layer.id } );
			_.each( children, this.validate_layer.bind( this ) );
			return;
		}
		this.parse_choices( layer );
	},

	/**
	 * Run validate_layer for one layer (and its descendant groups) without mutating the main errors list.
	 * Uses the same parse_choices / hooks path as full save validation — no duplicated rules.
	 *
	 * @param {Backbone.Model} layer Layer model from PC.fe.layers.
	 * @return {Array} Errors produced for that subtree only.
	 */
	collect_errors_for_layer: function( layer ) {
		if ( ! layer || ! layer.get ) return [];
		var prev = PC.fe.validation.errors;
		var capture = [];
		PC.fe.validation.errors = capture;
		PC.fe.errors = capture;
		try {
			this.validate_layer( layer );
			return capture.slice();
		} finally {
			PC.fe.validation.errors = prev;
			PC.fe.errors = prev;
		}
	},

	/**
	 * Re-validate the layer that owns a choice (same as collect_errors_for_layer on that layer).
	 *
	 * @param {Backbone.Model} choice Choice model with layerId.
	 * @return {Array}
	 */
	collect_errors_for_choice: function( choice ) {
		if ( ! choice || ! choice.get || ! PC.fe.layers ) return [];
		var layer = PC.fe.layers.get( choice.get( 'layerId' ) );
		return layer ? this.collect_errors_for_layer( layer ) : [];
	},
	count_selected_choices_in_group: function( group_id ) {
		var children = PC.fe.layers.filter( function( layer ) {
			return group_id == layer.get( 'parent' ) && false !== layer.get( 'cshow' );
		} );
		var selected = 0;
		_.each( children, function( child_layer ) {
			var type = child_layer.get( 'type' )
			if ( 'group' === type ) {
				selected += this.count_selected_choices_in_group( child_layer.id );
				return;
			}
			
			var choices = PC.fe.getLayerContent( child_layer.id );
			if ( ! choices ) return;

			if ( 'simple' === type || 'multiple' === type ) {
				var selection = choices.filter( function( choice ) {
					return choice.get( 'active' ) && false !== choice.get( 'cshow' );
				} );
				selected += selection.length;
			}
			if ( 'form' === type ) {
				var selection = PC.fe.getLayerContent( child_layer.id ).filter( function( choice ) {
					return false !== choice.get( 'cshow' ) && ! choice.get( 'is_group' );
				} );
				selected += selection.length;
			}
		}.bind( this ) );
		return selected;
	},
	// get choices for one layer 
	parse_choices: function( model ) {
		var is_required = parseInt( model.get( 'required' ) );
		var default_selection = model.get( 'default_selection' ) || 'select_first';
		var type = model.get( 'type' );

		// If the layer is hidden, ignore it
		if ( false === model.get( 'cshow' ) ) return;

		if ( 'form' == type || 'group' == type ) is_required = false;

		if ( PC.fe.config.angles.save_current ) {
			var angle = PC.fe.angles.findWhere( 'active', true );
		} else {
			var angle = PC.fe.angles.findWhere( 'use_in_cart', true );
		}
		if ( ! angle ) {
			angle = PC.fe.angles.first();
		}

		var model_data = wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', model.attributes );
		var angle_id = wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.angle_id', angle.id );

		if ( 'group' == type ) {
			if ( ! this.count_selected_choices_in_group( model.id ) ) return;
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_layer_group', true, model ) ) this.choices.push( 
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_group_layer',
					{
						is_choice: false,
						layer_id: model.id,
						choice_id: 0,
						angle_id: angle_id,
						layer_name: model_data.name,
						image: 0,
						name: '',
					},
					model
				)
			);
			return;
		}
		var require_error = false;
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) return;
		if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( model ) ) return;
		var first_choice = choices.first().id;
		if ( ! model.attributes.not_a_choice ) {
			// Simple with at least 2 items, and multiple choices
			if ( choices.length > 1 || 'multiple' == type ) {

				var selected_choices = choices.where( { 'active': true } );

				if ( is_required && ! selected_choices.length ) {
					require_error = true;
				}

				// Simple layer without a selection (e.g. all items are out of stock)
				if ( ! is_required && ! selected_choices.length && 'simple' == type && 'select_first' == default_selection && ! model.get( 'can_deselect' ) ) {
					require_error = true;
				}

				_.each( selected_choices, function( choice ) {
					if ( false === choice.get( 'cshow' ) ) return;
					if ( PC.hasOwnProperty( 'conditionalLogic' ) && PC.conditionalLogic.parent_is_hidden && PC.conditionalLogic.parent_is_hidden( choice ) ) return;
					// Check for a required item
					if ( 
						'select_first' == default_selection
						&& is_required 
						&& 'simple' == type
						&& first_choice == choice.id
					) {
						require_error = true;
					}

					// The item is out of stock, so throw an error
					if ( false === choice.get( 'available' ) ) {
						var separator_in = ( PC_config.lang && PC_config.lang.validation_separator_in ) ? PC_config.lang.validation_separator_in : ', ';
						PC.fe.validation.errors.push( {
							choice: choice,
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model_data.name + separator_in + choice.get_name() )
						} );
					}

					var img_id = choice.get_image( 'image', 'id' );
					var choice_data = {
						is_choice: true,
						layer_id: model.id,
						choice_id: choice.id,
						angle_id: angle_id,
						layer_name: model_data.name,
						image: img_id,
						name: choice.get_name(),
					};
					if ( choice.get( 'sku' ) ) choice_data.sku = choice.get( 'sku' );
					if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push( 
						wp.hooks.applyFilters(
							'PC.fe.save_data.parse_choices.added_choice',
							choice_data,
							choice
						)
					);
				}, this );

			} else {
				// Only one choice
				var choice = choices.first();
				var is_active = choice.get( 'active' );
				if ( is_active || ( 'simple' != model.get( 'type' ) && 'multiple' != model.get( 'type' ) && 'form' != model.get( 'type' ) ) ) {
					if ( false === choice.get( 'cshow' ) ) return;
					var img_id = choice.get_image('image', 'id'); 
					const choice_data = {
						is_choice: true,
						layer_id: model.id, 
						choice_id: choice.id, 
						angle_id: angle_id,
						image: img_id,
						layer_name: model_data.name,
						name: choice.get_name(),
					};	
				
					if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
						wp.hooks.applyFilters(
							'PC.fe.save_data.parse_choices.added_choice',
							choice_data,
							choice
						)
					);

					// The item is out of stock, so throw an error
					if ( false === choice.get( 'available' ) ) {
						var separator_in = ( PC_config.lang && PC_config.lang.validation_separator_in ) ? PC_config.lang.validation_separator_in : ', ';
						PC.fe.validation.errors.push( {
							choice: choice,
							message: PC_config.lang.out_of_stock_error_message.replace( '%s', model_data.name + separator_in + choice.get_name() )
						} );
					}
				} else if ( is_required ) {
					require_error = true;
				}
			}
		} else {
			// Not a choice
			var choice = choices.first();
			var img_id = choice.get_image('image', 'id');
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_choice',
					{
						is_choice: false,
						layer_id: model.id,
						choice_id: choice.id,
						angle_id: angle_id,
						image: img_id,
						name: choice.get_name(),
					}
				)
			);
		}

		if ( require_error ) {	
			PC.fe.validation.errors.push( {
				choice: false,
				layer: model,
				message: PC_config.lang.required_error_message.replace( '%s', model_data.name ) 
			} );
		}

		wp.hooks.doAction( 'PC.fe.save_data.parse_choices.after', model, this );
	},

	ajax_add_to_cart: function() {
		
	}

};

PC.fe.views.stepsProgress = Backbone.View.extend( {
	className: 'steps-progress--container',
	tagName: 'nav',
	initialize: function() {
		this.render();
		return this; 
	},
	events: {
		// 'click .configurator-add-to-cart': 'add_to_cart',
		// 'click .configurator-previous-step': 'previous_step',
		// 'click .configurator-next-step': 'next_step',
		// 'click .add-to-quote': 'add_to_quote'
	},
	render: function() {
		this.$ol = $( '<ol class="steps-progress" />' );
		PC.fe.steps.steps.each( this.add_step.bind( this ) );
		if ( wp.hooks.applyFilters( 'PC.fe.steps.display_marker', true ) ) {
			this.$marker = $( '<li class="steps-progress--item steps-progress--active-marker" />' );
			this.$ol.append( this.$marker );
		}
		this.$ol.appendTo( this.$el );
	},
	add_step: function( step ) {
		var item = new PC.fe.views.stepsProgressItem( { model: step } );
		item.$el.appendTo( this.$ol );
	},
} );

PC.fe.views.stepsProgressItem = Backbone.View.extend( {
	className: 'steps-progress--item',
	tagName: 'li',
	template: wp.template( 'mkl-pc-configurator-steps-progress--item' ),
	initialize: function() {
		this.listenTo( this.model, 'change:active change:cshow', this.render );
		this.render();
		return this; 
	},
	events: {
		'click a.step-link': 'on_click',
		// 'click .configurator-previous-step': 'previous_step',
		// 'click .configurator-next-step': 'next_step',
		// 'click .add-to-quote': 'add_to_quote'
	},
	render: function() {
		this.$el.toggleClass( 'active', this.model.get( 'active' ) );
		this.$el.toggleClass( 'hidden', false === this.model.get( 'cshow' ) );
		this.$el.html( this.template( this.model.attributes ) );
		if ( this.model.get( 'active' ) ) {
			setTimeout( function() {
				var $item = this.$el, 
					$container = $item.closest( '.steps-progress' ),
					width = $container.outerWidth(),
					position = $container.scrollLeft() + $item.position().left - width / 2 + $item.outerWidth() / 2;

				$container.animate( {
					scrollLeft: position
				}, 320)

				$container.css( {
					'--mkl_pc-steps-marker-width': $item.width() + "px",
					'--mkl_pc-steps-marker-pos': $item.get(0).offsetLeft + "px"
				} );
			}.bind( this ), 10 );
		}

	},
	on_click: function( e ) {
		e.preventDefault();
		if ( this.model.get( 'active' ) ) return;
		var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
		if ( PC.fe.steps.get_index( this.model ) < current_index || PC.fe.config.steps_progress_enable_click_all ) {
			PC.fe.steps.display_step( PC.fe.steps.get_index( this.model ) );
		}
	}
} );


// $(".js-tab-link").off("click").on("click", (function() {
// 	var t = $(this)
// 	  , e = t.closest(".js-tab-nav")
// 	  , n = e.outerWidth()
// 	  , i = e.scrollLeft() + t.position().left - n / 2 + t.outerWidth() / 2;
// 	e.animate({
// 		scrollLeft: i
// 	}, r.size.isMobile() ? 320 : 640)
// }
PC.fe.steps = {
	current_step: null,
	initiated: false,
	previous_button: null,
	next_button: null,
	steps: null,
	$nav: null,
	initialized: false,
	setup_steps: function() {
		if ( ! this.steps_possible() ) {
			PC.fe.use_steps = false;
			this.clean_existing_steps();
			return;
		}

		PC.fe.use_steps = true;

		/* Maybe reset elements */
		this.clean_existing_steps();

		this.get_steps();

		PC.fe.modal.$el.addClass( 'has-steps' );

		// add buttons
		if ( this.initialized ) return;

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator/steps', function( modal ) {
			if  ( ! PC.fe.use_steps || ! this.steps ) return;
			this.current_step = this.get_steps()[0];
			this.current_step.set( 'active', true );
			this.previous_button = new this.view_prev();
			this.next_button = new this.view_next();
			this.$nav = $( '<nav class="mkl-pc--steps" />' );
			this.$nav.append( this.previous_button.$el );
			this.$nav.append( this.next_button.$el );

			var nav_position = wp.hooks.applyFilters( 'PC.fe.steps_position', null, this.$nav );
			if ( ! nav_position ) modal.footer.$( '.pc_configurator_form' ).before( this.$nav );

			if ( wp.hooks.applyFilters( 'PC.fe.steps.display_breadcrumb', true ) ) {
				this.breadcrumb = new PC.fe.views.stepsProgress();
				var breadcrumb_position = wp.hooks.applyFilters( 'PC.fe.breadcrumb_position', null, this.breadcrumb );
				if ( ! breadcrumb_position ) modal.toolbar.$( 'section.choices' ).before( this.breadcrumb.$el );
			}

			this.$live = $( '<div class="mkl-pc-current-step-name screen-reader-text" aria-live="polite" aria-atomic="true"></div>' );
			modal.toolbar.$( 'section.choices' ).before( this.$live );

			this.display_step();
		}.bind( this ), 20 );

		wp.hooks.addAction( 'PC.fe.reset_configurator', 'mkl/product_configurator/steps', function() {
			this.display_step( 0 );
		}.bind( this ) );

		this.initialized = true;
	},
	update_live_region: function() {
		if ( ! this.current_step ) return;
		const current_step = this.get_index( this.current_step );
		const total_steps = PC.fe.steps.steps.length;
		const step_number = current_step + 1;
		const step_name = this.current_step.get( 'name' );
		const step_label = PC_config.lang.steps_progress_current_step.replace( '%1$s', step_number ).replace( '%2$s', total_steps ).replace( '%3$s', step_name );
		this.$live.text( step_label );
	},
	clean_existing_steps: function() {
		if ( this.steps ) this.steps = null;
		PC.fe.modal.$el.removeClass( 'has-steps' );
		PC.fe.modal.$el.removeClass( 'last-step' );
		PC.fe.modal.$el.removeClass( 'first-step' );
		if ( this.previous_button ) {
			this.$nav.remove();
			this.$nav = null;
			this.previous_button.remove();
			this.previous_button = null;
			this.next_button.remove();
			this.next_button = null;
		}

		if ( this.breadcrumb ) {
			this.breadcrumb.remove();
			this.breadcrumb = null;
		}
	},
	steps_possible: function() {
		var steps = PC.fe.layers.filter( function( model ) {
			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return 'group' == model.get( 'type' ) && ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );

		var all_root_layers = PC.fe.layers.filter( function( model ) {
			// A valid step is visible, has a type of Group, and doesn't have a parent (only root elements can be steps ) 
			return ( ! model.get( 'parent' ) || ( model.get( 'parent' ) && ! PC.fe.layers.get( model.get( 'parent' ) ) ) );
		} );

		// ALL root layers must be groups for the steps to work.
		return steps.length && steps.length == all_root_layers.length;
	},	
	previous_step: function() {
		var current_index = this.get_index( this.current_step );
		if ( 0 === current_index ) return;
		var steps = this.get_steps();
		// steps[this.current_step].set( 'active', false );
		this.display_step( current_index - 1 );
	},
	next_step: function() {
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );
		
		if ( current_index == steps.length - 1 ) return;

		var urlParams = new URLSearchParams( location.search );
		var proceed = urlParams.has( 'pc-presets-admin' );

		PC.fe.clear_validation_errors();

		var validated_layer = PC.fe.save_data.is_layer_valid( this.current_step );
		var errors = wp.hooks.applyFilters( 'PC.fe.validate_configuration', PC.fe.errors );
		validated_layer = validated_layer && ! errors.length;
		if ( ! proceed && ! validated_layer ) {
			if ( errors.length ) {
				if ( PC.fe.show_validation_errors ) {
					PC.fe.show_validation_errors( errors );
				}
				return false;
			}
		}

		this.display_step( current_index + 1 );
	},
	display_step: function( ind ) {
		PC.fe.save_data.reset_errors();
		var steps = this.get_steps();
		var current_index = this.get_index( this.current_step );

		// Change step
		if ( 'undefined' != typeof ind && current_index != ind && steps[ind] ) {
			this.deactivate_all_layers();
			this.current_step = steps[ind];
			this.current_step.set( 'active', true );
			current_index = ind;
		}

		PC.fe.modal.$el.toggleClass( 'last-step', !! ( current_index == steps.length - 1 ) );

		PC.fe.modal.$el.toggleClass( 'first-step', 0 == current_index );
		
		if ( PC_config.config.open_first_layer && PC.fe.modal.$el.is( '.float, .wsb' ) ) {
			setTimeout( function() {
				var $first = PC.fe.modal.$( '.type-step.active button.layer-item:visible' ).first();
				if ( ! $first.parent().is( '.display-mode-dropdown' ) ) $first.trigger( 'click' );
			}, 50 );
		}

		this.update_live_region();

		wp.hooks.doAction( 'PC.fe.steps.display_step', this );
	},
	get_steps: function() {
		if ( ! this.steps ) {
			// Create the collection
			var col = Backbone.Collection.extend( { model: PC.layer } );
			this.steps = new col();

			// Populate with the layers
			PC.fe.layers.each( function( layer ) {
				if ( 'group' == layer.get( 'type' ) && ( ! layer.get( 'parent' ) || ( layer.get( 'parent' ) && ! PC.fe.layers.get( layer.get( 'parent' ) ) ) ) ) {
					layer.set( 'is_step', true );
					this.steps.add( layer );
				}
			}.bind( this ) );
		}

		return this.steps.filter( function( model ) {
			return ! ( false === model.get( 'cshow' ) );
		} );
	},
	get_index: function( step ) {
		// Because of conditional logic, the index of an item can change.
		return _.indexOf( this.get_steps(), step );
	},
	deactivate_all_layers: function() {
		PC.fe.layers.each( function( model ) {
			model.set( 'active' , false );
		});
	},
	view_prev: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--previous' ),
		className: 'step-container--previous',
		events: {
			'click button.step-previous ': 'previous'
		},
		initialize: function() {
			wp.hooks.addAction( 'PC.fe.steps.display_step', 'mkl/pc/steps', this.render.bind( this ) );
			if ( 'undefiled' != typeof PC.conditionalLogic ) this.listenTo( PC.fe.steps.steps, 'change:cshow', this.render );
			this.render();
		},
		render: function() {
			// Render once, then update state in place (preserves focus).
			if ( ! this.$( 'button.step-previous' ).length ) {
				this.$el.html( this.template({}) );
			}
			var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
			if ( 0 == current_index ) {
				this.$( 'button.step-previous' ).prop( 'disabled', true );
			} else {
				this.$( 'button.step-previous' ).prop( 'disabled', false );
			}
	
		},
		previous: function( e ) {
			e.preventDefault();
			PC.fe.steps.previous_step();
		}
	} ),
	view_next: Backbone.View.extend( {
		template: wp.template( 'mkl-pc-configurator-step--next' ),
		className: 'step-container--next',
		events: {
			'click button.step-next ': 'next'
		},
		initialize: function() {
			wp.hooks.addAction( 'PC.fe.steps.display_step', 'mkl/pc/steps', this.render.bind( this ) );
			if ( 'undefiled' != typeof PC.conditionalLogic ) {
				this.listenTo( PC.fe.steps.steps, 'change:cshow', this.render );
			}
			this.render();
		},
		render: function() {
			// Render once, then update label/state in place (preserves focus).
			if ( ! this.$( 'button.step-next' ).length ) {
				this.$el.html( this.template({ label: '' }) );
			}

			var label = '';
			if ( PC.fe.config.steps_use_layer_name ) {
				var steps = PC.fe.steps.get_steps();
				var current_index = PC.fe.steps.get_index( PC.fe.steps.current_step );
				if ( current_index < steps.length - 1 ) {
					var next_step = steps[current_index + 1];
					label = next_step.get( 'next_step_button_label' ) || next_step.get( 'name' );
				}
			} 
			if ( label ) {
				this.$( 'button.step-next > span:not(.screen-reader-text)' ).first().text( label );
			}
		},
		next: function( e ) {
			e.preventDefault();
			PC.fe.steps.next_step();
		}
	} ),
};

PC.fe.views.summary = Backbone.View.extend( {
	tagName: 'li',
	className: 'layers-list-item mkl_pc_summary type-summary',
	template: wp.template( 'mkl-pc-configurator-summary' ),
	layers: [],
	initialize: function() {
		this.render();
		
		if ( PC.conditionalLogic ) {
			wp.hooks.addAction( 'mkl_checked_conditions', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		} 
		wp.hooks.addAction( 'PC.fe.choice.set_choice', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		wp.hooks.addAction( 'PC.fe.form.item.change', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		wp.hooks.addAction( 'PC.fe.text_overlay.item.change', 'mkl/pc/summary', this.render.bind( this ), 1000 );
		return this;
	},
	render: function () {
		
		this.clear();
		this.$el.append( this.template( this?.model?.attributes || {} ) );

		const $target = this.$( '.mkl-pc-summary--content' );
		
		if ( !$target.length ) $target = this.$el;

		var choices = PC.fe.save_data.get_choices( false );
		_.each( choices, function( item ) {
			var layer = PC.fe.layers.get( item.layer_id );
			var choice = PC.fe.get_choice_model( item.layer_id, item.choice_id );
			if ( ! layer ) return;
			if ( 'simple' == layer.get( 'type' ) && layer.get( 'not_a_choice' ) ) return;
			// if ( wp.hooks.applyFilters( 'hide_in_configurator-also-hides-in-summary', true, item ) && layer.get( 'hide_in_configurator') ) return;
			if ( layer.get( 'hide_in_summary') ) return;
			if ( ! this.layers[ item.layer_id ] ) {
				this.layers[ item.layer_id ] = new PC.fe.views.summary_item_group( { model: layer } );
				if ( layer.get( 'parent' ) && this.$( '[data-layer_id="' + layer.get( 'parent' ) + '"]' ).length ) {
					this.layers[ item.layer_id ].$el.appendTo( this.$( '[data-layer_id="' + layer.get( 'parent' ) + '"]' ) );
				} else {
					this.layers[ item.layer_id ].$el.appendTo( $target );
				}
			}

			// if ( ! choice ) console.log( item.layer_id, item.choice_id );
			if ( choice ) {
				if ( 'calculation' == choice.get( 'text_field_type' ) ) return;
				if ( 'form' == layer.get( 'type' ) && ( 'undefined' === typeof choice.get( 'field_value' ) || '' === choice.get( 'field_value' ) ) ) return;
				var view = new PC.fe.views.summary_item( { model: choice } );
				this.layers[ item.layer_id ].$el.append( view.$el );
			}

		}.bind( this ) );

		// Cleanup
		this.$( '.mkl_pc_summary_item_group.group' ).each( function( i, item ) {
			if ( ! $( item ).find( '.mkl_pc_summary_item_group' ).length ) {
				$( item ).remove()
			}
		} );

		/**
		 * Triggered whenthe summary has been rendered. 
		 * It is rendered every time a change to the data is done
		 */
		wp.hooks.doAction( 'PC.fe.configurator.summary.render', this );
		return this.$el;
	},
	clear: function() {
		if ( this.layers.length ) {
			_.each( this.layers, function( item, key ) {
				if ( item ) item.remove();
			} );
			this.layers = [];
		}
		this.$el.empty();
	}
} );

PC.fe.views.summary_item_group = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_summary_item_group',
	template: wp.template( 'mkl-pc-configurator-summary--item-group' ), 
	initialize: function() {
		this.render();
		return this; 
	},
	render: function() {
		this.$el.html( this.template( wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', this.model.attributes ) ) );
		this.$el.attr( 'data-layer_id', this.model.id );
		this.$el.addClass( this.model.get( 'type' ) );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
	}
} );

PC.fe.views.summary_item = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_summary_item',
	template: wp.template( 'mkl-pc-configurator-summary--item' ),
	initialize: function() {
		this.render();
		return this; 
	},
	render: function() {
		// Apply PC.fe.configurator.choice_data filter, used for language mostly, at order 2000
		var attributes = JSON.parse( JSON.stringify( wp.hooks.applyFilters( 'PC.fe.configurator.choice_data', this.model.attributes ) ) );
		if ( this.model.get( 'parent' ) ) {
			var parent = this.model.collection.get( this.model.get( 'parent' ) );
			if ( parent && parent.get( 'show_group_label_in_cart' ) ) attributes.parent_name = parent.get_name();
		}
		attributes = wp.hooks.applyFilters( 'PC.fe.summary_item.attributes', attributes, this.model );
		this.$el.html( this.template( attributes, this.model ) );
		if ( this.model.get( 'class_name' ) ) this.$el.addClass( this.model.get( 'class_name' ) );
		if ( 'form' == this.model.collection.layer_type || this.model.get( 'has_text_field' ) ) {
			this.$el.addClass( 'has-form-field field-' + this.model.get( 'text_field_type' ) );
			if ( this.model.get( 'text_field_id' ) ) this.$el.attr( 'data-field-id', this.model.get( 'text_field_id' ) );
		}
		wp.hooks.doAction( 'PC.fe.configurator.summary-item.render.after-template', this );
	}
} );


/*
	PC.fe.views.toolbar 
*/
PC.fe.views.toolbar = Backbone.View.extend({
	tagName: 'div', 
	className: 'mkl_pc_toolbar', 
	template: wp.template( 'mkl-pc-configurator-toolbar' ),
	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		return this; 
	},

	events: {
		'click .cancel': 'close_configurator',
		// 'click .configurator-add-to-cart': 'add_to_cart'
	},

	render: function() {
		this.$el.append( this.template( { name: this.parent.options.title, ID: PC.fe.active_product } ) );
		this.$selection = this.$el.find('.choices'); 
		// this.get_cart(); 
		this.layers = new PC.fe.views.layers_list( { parent: this } );
		return this.$el; 
	}, 

	close_configurator: function( event ) {
		this.parent.close(); 
	}
});

PC.fe.views.viewer_static_layer = Backbone.View.extend({
	tagName: wp.hooks.applyFilters( 'PC.fe.viewer.item.tag', 'img' ),
	events: {
		'load': 'loaded',
		'error': 'loaded',
		'abort': 'loaded',
		'stalled': 'loaded',
	},
	initialize: function( options ) { 
		this.listenTo( PC.fe.angles, 'change active', this.render );

		this.parent = options.parent || PC.fe;
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );

		this.render(); 

		return this; 
	},
	loaded: function(event) {
		this.$el.removeClass( 'loading' );
		wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );
		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},
	render: function() {
		var img = this.model.get_image();
		// Default to a transparent image
		if ( ! img ) img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

		wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

		var classes = [ 'active', 'static', 'loading' ];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = PC.fe.layers.get( this.model.get( 'layerId' ) ).get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		
		// a11y - hide images from being read
		this.$el.attr( 'aria-hidden', 'true' );

		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.static_layer.classes', classes, this );
		this.$el.addClass( classes.join( ' ' ) );
		if ( img ) {
			this.el.src = img;
			this.parent.imagesLoading ++;
			this.parent.$el.addClass('is-loading-image');
		}
		this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );
		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
		return this.$el; 
	}		
});

PC.fe.views.viewer_layer = Backbone.View.extend({ 
	tagName: 'img', 
	events: {
		'load': 'img_loaded',
		'error': 'img_loaded',
		'abort': 'img_loaded',
		'stalled': 'img_loaded',
	},
	initialize: function( options ) { 
		this.empty_img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
		this.parent = options.parent || PC.fe;
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		this.is_loaded = false;
		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'preload-image', this.preload_image );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
		wp.hooks.doAction( 'PC.fe.choice-img.init', this );

		this.render(); 

		return this; 
	},
	render: function( force ) {
			
		var is_active = this.model.get( 'active' );
		var img = this.model.get_image();
		const width = PC.fe.modal.$el.outerWidth();
		if ( width && PC.fe.config.mobile_image_breakpoint && width < PC.fe.config.mobile_image_breakpoint && this.model.get_image( 'image', 'url_mobile' ) ) {
			img = this.model.get_image( 'image', 'url_mobile' );
		}
		if ( width && PC.fe.config.large_image_breakpoint && width >= PC.fe.config.large_image_breakpoint && this.model.get_image( 'image', 'url_large' ) ) {
			img = this.model.get_image( 'image', 'url_large' );
		}
		var classes = [];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = this.layer.get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
		// Add the classes
		this.$el.addClass( classes.join( ' ' ) );
		// Default to a transparent image
		if ( ! img ) img = this.empty_img;

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( is_active ) {
			if ( ! this.is_loaded ) {
				this.parent.imagesLoading ++;
				this.parent.$el.addClass('is-loading-image');
				this.$el.addClass( 'loading' );
				this.el.src = img
			} 
			this.$el.addClass( 'active' );
		} else {
			if ( ! this.is_loaded ) {
				this.$el.addClass( 'loading' );
				if ( 'lazy' == PC.fe.config.image_loading_mode && ! force ) {
					this.el.src = this.empty_img;
				} else {
					this.el.src = img;	
				}
			}
			this.$el.removeClass( 'active' );
		}
		
		this.$el.data( 'dimensions', this.model.get_image( 'image', 'dimensions' ) );
		
		// a11y - hide images from being read
		if ( ! this.$el.attr( 'data-layer' ) ) {
			this.$el.attr( 'aria-hidden', 'true' );
			this.$el.attr( 'data-layer', this.layer.get( 'admin_label' ) || this.layer.get( 'name' ) );
			this.$el.attr( 'data-choice', this.model.get( 'admin_label' ) || this.model.get( 'name' ) );
			this.$el.attr( 'data-layer_id', this.layer.id );
			this.$el.attr( 'data-choice_id', this.model.id );
		}

		wp.hooks.doAction( 'PC.fe.viewer.layer.render.after', this );
		return this.$el; 
	},
	// get_image_url: function( choice_id, image ) {
	// 	image = image || 'image'; 
	// 	var active_angle = PC.fe.angles.findWhere( { active: true } );
	// 	var angle_id = active_angle.id; 

	// 	return this.choices.get( choice_id ).attributes.images.get( angle_id ).attributes[image].url; 
	// },
	change_layer: function( model ) {
		this.render();
	},
	change_angle: function( model ) {
		if ( model.get( 'active' ) ) {
			this.is_loaded = false;
			this.render();
		}
	},
	img_loaded: function( e ) {
		this.$el.removeClass( 'loading' );
		if (this.empty_img == this.$el.prop('src')) return;
		this.is_loaded = true;

		if ( 'load' == e.type ) wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}

	},
	toggle_current_layer_class: function( layer, new_val ) {
		if ( layer.id !== this.model.get( 'layerId' ) ) return;
		this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) && new_val );
	},
	preload_image: function( e ) {
		if ( this.model.get( 'active' ) ) return;
		if ( ! this.model.get_image() || this.el.src == this.model.get_image() ) return;
		
		this.render( true );
		// if ( ! src ) return;
		// var img = new Image();
		// img.src = src;
	}
}); 

PC.fe.views.viewer_layer_html = Backbone.View.extend({ 
	tagName: 'div',
	className: 'custom-html',
	initialize: function( options ) {
		var that = this;
		this.parent = options.parent || PC.fe;
		this.layer = PC.fe.layers.get( this.model.get( 'layerId' ) )
		this.listenTo( this.model, 'change:active', this.change_layer );
		this.listenTo( this.model, 'change:cshow', this.conditional_display );
		this.listenTo( this.layer, 'change:cshow', this.conditional_display );
		this.listenTo( PC.fe.layers, 'change:active', this.toggle_current_layer_class );
		// this.listenTo( PC.fe.angles, 'change:active', this.change_angle );
		wp.hooks.doAction( 'PC.fe.choice-custom-html.init', this );

		this.render(); 

		return this; 
	},
	render: function() {
			
		var is_active = this.model.get( 'active' );
		var classes = [];
		
		classes.push( this.model.collection.getType() );
		
		var layer_class = this.layer.get( 'class_name' );
		if ( layer_class ) classes.push( layer_class );
		if ( this.model.get( 'class_name' ) ) classes.push( this.model.get( 'class_name' ) );
		/**
		 * Filter the classes applied to the image
		 */
		classes = wp.hooks.applyFilters( 'PC.fe.viewer.layer.classes', classes, this );
		// Add the classes
		this.$el.addClass( classes.join( ' ' ) );
		// Default to a transparent image

		wp.hooks.doAction( 'PC.fe.viewer.layer.render', this );

		if ( is_active ) {
			this.$el.addClass( 'active' );
		} else {
			this.$el.removeClass( 'active' );
		}

		this.$el.html( this.model.get( 'custom_html' ) );

		return this.$el; 
	},
	change_layer: function( model ) {
		this.$el.toggleClass( 'active', this.model.get( 'active' ) );
		this.conditional_display();
		// this.render();
	},
	toggle_current_layer_class: function( layer, new_val ) {
		if ( layer.id !== this.model.get( 'layerId' ) ) return;
		this.$el.toggleClass( 'current_layer', layer.id == this.model.get( 'layerId' ) && new_val );
	},
	conditional_display: function() {
		var model_cshow = false !== this.model.get( 'cshow' );
		var layer_cshow = false !== this.layer.get( 'cshow' );
		this.$el.toggle( this.model.get( 'active' ) && model_cshow && layer_cshow );
	}
});

/*
	PC.fe.views.viewer
	-> Main view containing the product visuals and the background image.
*/

PC.fe.views.viewer = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc_viewer',
	template: wp.template( 'mkl-pc-configurator-viewer' ), 
	imagesLoading: 0,
	initialize: function( options ) {
		this.parent = options.parent || PC.fe; 
		this.imagesLoading = 0;
		return this; 
	},

	events: {
		'change_layer': 'change_layer' 
	},

	render: function( ) { 
		wp.hooks.doAction( 'PC.fe.viewer.render.before', this );

		this.$el.append( this.template() ); 

		if ( PC.fe.contents ) {
			if ( PC.fe.angles.length > 1 ) {
				this.angles_selector = new PC.fe.views.angles({ parent: this }); 
				this.$el.append( this.angles_selector.render() );
			} else if ( PC.fe.angles.length ) {
				PC.fe.angles.first().set( 'active', true );
			} else {
				console.error( 'Product configurator: there are no angles set. Please complete the product setup.' );
				return;
			}

			this.$layers = this.$el.find( '.mkl_pc_layers' ); 
			this.layers = [];

			this.add_layers();
			this.add_loader();
	

		} else {
			console.log('no content to show.');
		}
		
		wp.hooks.doAction( 'PC.fe.viewer.render', this );

		return this.$el; 

	},

	add_loader: function() {
		this.$layers.append( $( '<div class="images-loading" />' ) );
	},

	add_layers: function() {
		var orders = PC.fe.layers.pluck( 'image_order' );
		if ( orders.length && _.max( orders ) ) {
			PC.fe.layers.orderBy = 'image_order';
			PC.fe.layers.sort();
		}
		PC.fe.layers.each( this.add_choices, this );
	}, 

	add_choices: function( model ) {
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) {
			return;
		}
		if ( model.get( 'not_a_choice') ) {
			var choice = choices.first();
			var layer = new PC.fe.views.viewer_static_layer( { model: choice, parent: this } );
			this.$layers.append( layer.$el );
			if ( choice.get( 'custom_html' ) ) {
				var content;
				try {
					content = $( choice.get( 'custom_html' ) );
				} catch( e ) {
					content = $( '<div class="mkl-custom-html--container" />' );
					content.html( choice.get( 'custom_html' ) )
				}
				this.$layers.append( content );
			}
		} else {
			choices.each( this.add_single_choice, this );
		}
	},

	add_single_choice: function( model ) {
		if ( model.has_image() || wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, model ) ) {
			var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, model, this );
			var layer = new View( { model: model, parent: this } ); 
			this.$layers.append( layer.$el );
		} else {
			layer = false;
		}

		wp.hooks.doAction( 'PC.fe.viewer.item.added', layer, this );
		if ( model.get( 'custom_html' ) ) {
			var html_layer = new PC.fe.views.viewer_layer_html( { model: model, layer: layer, parent: this } );
			this.$layers.append( html_layer.$el );
			wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_layer, this );
		}
		this.layers[ model.id ] = layer;
	}
});
} ) ( jQuery, PC._us || window._ );
