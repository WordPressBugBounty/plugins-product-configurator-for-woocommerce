var PC = PC || {};
PC.fe = PC.fe || {};

PC.fe.views = PC.fe.views || {};
PC.options = PC.options || {};

!( function( $, _ ) {

'use strict';
/*
	PC.fe.views.viewer_3d is registered by the fe-3d-viewer bundle when the product is 3D.
	This filter selects the 3D viewer when settings_3d and a model URL are present.
*/
( function() {
	if ( typeof wp === 'undefined' || ! wp.hooks || ! wp.hooks.addFilter ) return;
	wp.hooks.addFilter( 'PC.fe.viewer.main_view', 'PC.fe.3d', function( defaultView ) {
		var data = PC.fe && PC.fe.currentProductData;
		if ( data && data.settings_3d && PC.fe.views.viewer_3d ) {
			return PC.fe.views.viewer_3d;
		}
		return defaultView;
	} );
} )();

/**
 * Add to cart modal view
 */
PC.fe.views.add_to_cart_modal = Backbone.View.extend({
	tagName: 'div',
	className: 'adding-to-cart--modal',
	template: wp.template( 'mkl-pc-configurator-add-to-cart--modal' ),
	initialize: function( options ) {
		this.busy = false;
		this.return_focus = null;
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
	 * @return {boolean}
	 */
	is_open: function() {
		return $( document.body ).hasClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Show the modal, remembering where the focus goes back to when it closes
	 *
	 * @param {Element} [return_focus] Defaults to the focused element.
	 */
	open: function( return_focus ) {
		if ( ! this.is_open() ) {
			var target = return_focus || document.activeElement;
			this.return_focus = target && target !== document.body && ! $.contains( this.el, target ) ? target : null;
		}
		$( document.body ).addClass( 'show-add-to-cart-modal' );
	},
	/**
	 * Close modal
	 */
	close: function() {
		var was_open = this.is_open();
		$( document.body ).removeClass( 'show-add-to-cart-modal' );
		this.set_busy( false );
		if ( ! was_open ) return;

		var target = this.return_focus;
		this.return_focus = null;
		if ( target && document.body.contains( target ) && $( target ).is( ':visible' ) ) {
			PC.fe.a11y.focus_without_scroll( $( target ) );
		}
		this.trigger( 'close', this );
	},
	/**
	 * A busy modal (sending a quote request) does not close on Escape, as its result would not be seen
	 *
	 * @param {boolean} busy
	 */
	set_busy: function( busy ) {
		this.busy = !! busy;
		this.$el.attr( 'aria-busy', this.busy ? 'true' : null );
	},
	/**
	 * Keyboard while the modal is open, called by the configurator which listens on the document:
	 * Escape closes the modal and leaves the configurator open, Tab stays in the modal.
	 *
	 * @param {KeyboardEvent} event
	 */
	keydown: function( event ) {
		if ( 'Escape' === event.key ) {
			event.preventDefault();
			if ( ! this.busy ) this.close();
			return;
		}
		if ( 'Tab' !== event.key ) return;

		// The honeypot of the quote request form, and other inputs taken out of the tab order.
		var $focusable = PC.fe.a11y.filter_focusable( this.$( PC.fe.a11y.modal_focusable_selector ) ).not( '[tabindex="-1"]' );
		var active = document.activeElement;
		if ( ! $focusable.length ) {
			event.preventDefault();
			return;
		}
		var first = $focusable[0];
		var last = $focusable[ $focusable.length - 1 ];
		// Outside the modal, or on an element focused by script such as a title.
		var astray = ! $.contains( this.el, active ) || -1 === $focusable.index( active );
		// A radio group is one tab stop.
		var on_first = active === first || ( 'radio' === active.type && 'radio' === first.type && active.name === first.name );
		if ( event.shiftKey && ( astray || on_first ) ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( last ) );
		} else if ( ! event.shiftKey && ( astray || active === last ) ) {
			event.preventDefault();
			PC.fe.a11y.focus_without_scroll( $( first ) );
		}
	},
	/**
	 * Show messages
	 */
	on_adding: function() {
		// Not busy: a failed request leaves the modal on this message, and Escape is the way out.
		this.open();
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
		this.set_busy( false );
		this.$el.empty().append( wp.template( 'mkl-pc-atc-' + type )( { messages: messages || '' } ) );
	},
	/**
	 * Open the modal on a given template, for flows other than the cart (the quote request).
	 *
	 * @param {string} template_id wp.template id, without the `tmpl-` prefix.
	 * @param {Object} data        Template data.
	 */
	show_template: function( template_id, data ) {
		this.open();
		this.set_busy( false );
		this.$el.empty().append( wp.template( template_id )( data || {} ) );
		// The first action takes the focus, so a keyboard user lands on the choices it offers.
		this.$( 'button, a.button' ).first().trigger( 'focus' );
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
	PC.fe.choice_color
	-> Solid-colour choices: a choice with no image on a view fills its layer's mask with its
	   colour hex code, when the layer has `draw_choice_color` on. One rule for the <img>
	   stack, the canvas viewer and the server. See docs/solid-colour-choices-spec.md.

	The admin keeps a copy of normalize(), fill_for() and svg_url() in
	admin/js/views/choice-color.js (PC.views.choice_color_hint) for its previews: these parts
	are not shipped as files of their own. choice-color.test.js checks both copies agree.
*/
PC.fe.choice_color = {

	/**
	 * '#rgb' or '#rrggbb' as '#rrggbb' in lower case, else ''. Other CSS colours stay
	 * swatch-only (decision 5 of the spec). Same rule as the server's Configuration::
	 * normalize_color().
	 *
	 * @param {*} value
	 * @return {String}
	 */
	normalize: function( value ) {
		var hex = String( null == value ? '' : value ).trim().toLowerCase();
		if ( /^#[0-9a-f]{6}$/.test( hex ) ) return hex;
		if ( /^#[0-9a-f]{3}$/.test( hex ) ) return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
		return '';
	},

	/**
	 * What a choice draws as a colour on a view, or null when it draws no colour there.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String}  [angle_id] The active view by default.
	 * @return {Object|null} { color, mask: { id, url, dimensions }, width, height }
	 */
	fill: function( choice, angle_id ) {
		if ( ! choice ) return null;
		var layer = PC.fe.layers && PC.fe.layers.get( choice.get( 'layerId' ) );
		angle_id = this.angle_id( angle_id );
		if ( null === angle_id ) return null;
		return this.fill_for( layer, choice, angle_id );
	},

	/**
	 * The rule, given the layer and the view:
	 * - the layer has `draw_choice_color` on (simple and multiple layers only);
	 * - the choice has no image on the view (an image wins, decision 4);
	 * - its colour is a hex code;
	 * - the layer has a mask on the view, with its size: the fill takes the mask's size.
	 *
	 * @param {Backbone.Model} layer
	 * @param {Backbone.Model} choice
	 * @param {Number|String}  angle_id
	 * @return {Object|null} { color, mask: { id, url, dimensions }, width, height }
	 */
	fill_for: function( layer, choice, angle_id ) {
		if ( ! layer || ! choice || choice.get( 'is_group' ) ) return null;
		if ( ! layer.get( 'draw_choice_color' ) || layer.get( 'not_a_choice' ) ) return null;
		var type = layer.get( 'type' );
		if ( 'simple' !== type && 'multiple' !== type ) return null;
		if ( undefined === angle_id || null === angle_id || '' === angle_id ) return null;

		var images = choice.get( 'images' );
		var picture = null;
		if ( images && images.get ) picture = images.get( angle_id );
		if ( ! picture && images && images.find ) {
			picture = images.find( function( model ) {
				var id = model.get ? model.get( 'angleId' ) : model.angleId;
				return String( id ) === String( angle_id );
			} );
		}
		var image = picture ? ( picture.get ? picture.get( 'image' ) : picture.image ) : null;
		if ( image && image.url ) return null;

		var color = this.normalize( choice.get( 'color' ) );
		if ( ! color ) return null;

		var masks = layer.get( 'masks' );
		var entry = null;
		for ( var i = 0; masks && i < masks.length; i++ ) {
			if ( masks[ i ] && String( masks[ i ].angleId ) === String( angle_id ) ) {
				entry = masks[ i ];
				break;
			}
		}
		var mask = entry && entry.image && entry.image.url ? entry.image : null;
		var width = mask && mask.dimensions ? parseInt( mask.dimensions.width, 10 ) : 0;
		var height = mask && mask.dimensions ? parseInt( mask.dimensions.height, 10 ) : 0;
		if ( ! mask || ! ( width > 0 ) || ! ( height > 0 ) ) return null;

		return { color: color, mask: mask, width: width, height: height };
	},

	/**
	 * The fill as an image URL: an SVG of the mask's size holding one rectangle. Vector, so
	 * the browser draws it at the size it is shown and keeps no full-size bitmap (decision 2).
	 * Its width and height make the <img> the mask's size, which themes then fit like any
	 * layer image, so the CSS mask lies over it.
	 *
	 * @param {Object} fill From fill().
	 * @return {String}
	 */
	svg_url: function( fill ) {
		var w = fill.width, h = fill.height;
		return 'data:image/svg+xml,' + encodeURIComponent(
			'<svg xmlns="http://www.w3.org/2000/svg" data-pc-color="' + fill.color + '" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' +
			'<rect width="' + w + '" height="' + h + '" fill="' + fill.color + '"/></svg>'
		);
	},

	/**
	 * Whether a src is a fill from svg_url() (it is cut by the layer's mask, unlike the
	 * transparent placeholder and other data URLs).
	 *
	 * @param {String} src
	 * @return {Boolean}
	 */
	is_fill_url: function( src ) {
		return 'string' === typeof src && 0 === src.indexOf( 'data:image/svg+xml,' + encodeURIComponent( '<svg xmlns="http://www.w3.org/2000/svg" data-pc-color=' ) );
	},

	/**
	 * The fill as a canvas, for capture(): drawn with fillRect rather than from the SVG, so
	 * no browser can count it as tainting the capture.
	 *
	 * @param {Object} fill From fill().
	 * @return {HTMLCanvasElement}
	 */
	fill_canvas: function( fill ) {
		var canvas = document.createElement( 'canvas' );
		canvas.width = fill.width;
		canvas.height = fill.height;
		var ctx = canvas.getContext( '2d' );
		ctx.fillStyle = fill.color;
		ctx.fillRect( 0, 0, fill.width, fill.height );
		return canvas;
	},

	/**
	 * The `image` a choice is saved with: its image id, or `s<rrggbb>` when it draws its
	 * colour on that view. The server merges that token like an image (Configuration::
	 * parse_color_image()), and stored configurations keep it, so past orders keep their colour.
	 *
	 * @param Backbone.Model  choice
	 * @param {Number|String} [angle_id]
	 * @return {Number|String} The image id, the colour token, or '' / undefined for none.
	 */
	saved_image: function( choice, angle_id ) {
		var img_id = choice.get_image( 'image', 'id', angle_id );
		if ( img_id ) return img_id;
		var fill = this.fill( choice, angle_id );
		return fill ? 's' + fill.color.slice( 1 ) : img_id;
	},

	/**
	 * Whether a choice draws a colour on any view.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	has_fill: function( choice ) {
		if ( ! PC.fe.angles ) return false;
		var self = this;
		return !! PC.fe.angles.find( function( angle ) {
			return !! self.fill( choice, angle.id );
		} );
	},

	/**
	 * The view asked for, else the active one, else the first; null when there are none.
	 */
	angle_id: function( angle_id ) {
		if ( undefined !== angle_id && null !== angle_id && '' !== angle_id ) return angle_id;
		if ( ! PC.fe.angles ) return null;
		var angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		return angle ? angle.id : null;
	},
};

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
		// Third argument: who made the selection. See PC.fe.select_choice.
		wp.hooks.doAction( 'PC.fe.choice.set_choice', this.model, this, { origin: 'user' } )
	},
	preload_image: function() {
		// console.log('preload image');
		// Pass the model: a listener bound to the collection (the viewer's image
		// pool) gets the arguments as given, with no model of its own to work from.
		this.model.trigger( 'preload-image', this.model );
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
				// Choosing with the arrow keys is a person choosing, exactly as a
				// click is. Announce it so conditional logic (and anything else on
				// this hook) sees it; without this, keyboard users could change the
				// selection without the conditions that depend on it re-evaluating.
				PC.fe.last_clicked = next_view;
				wp.hooks.doAction( 'PC.fe.choice.set_choice', next_view.model, next_view, { origin: 'user' } );
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
		// Engine mode never auto-mounts. `PC.fe.start` already fired from init().
		if ( wp.hooks.applyFilters( 'PC.fe.headless', !! PC.fe.headless ) ) {
			return;
		}

		if ( this.toolbar ) this.toolbar.remove();
		if ( this.viewer ) this.viewer.remove();
		if ( this.footer ) this.footer.remove();
		this.toolbar = null;
		this.viewer = null;
		this.footer = null;

		// Settle the models before a single view exists: default selections, the
		// configuration being edited, then conditional logic. Views are built from
		// a state that is already final, which is what lets the layers list skip
		// the layers conditional logic hides instead of rendering them and hiding
		// them a moment later.
		PC.fe.prepare_initial_state( this );

		if ( wp.hooks.applyFilters( 'PC.fe.render_viewer', true ) ) {
			PC.fe.mountViewer( this.$main_window );
		}

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
			if ( this.viewer ) {
				this.toolbar = new PC.fe.views.empty_viewer();
				this.viewer.$el.append( this.toolbar.render() );
			}
		} else {
			if ( wp.hooks.applyFilters( 'PC.fe.render_toolbar', true ) ) {
				PC.fe.mountToolbar( this.$main_window );
			}
			if ( wp.hooks.applyFilters( 'PC.fe.render_footer', true ) ) {
				PC.fe.mountFooter( this.$main_window );
			}
		}

		this.refresh_main_window_accessibility();

		$( PC.fe ).trigger( 'start', this );
		wp.hooks.doAction( 'PC.fe.start', this ); 
		this.open();
	},
	resetConfig: function() {
		PC.fe.reset_configuration();
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
		// The add to cart modal, which also shows the quote request form, is in front of everything but the SYD modals.
		if ( PC.fe.add_to_cart_modal && PC.fe.add_to_cart_modal.is_open() && ! $( 'body' ).is( '.syd-modal-opened, .syd-share-modal-opened' ) ) {
			PC.fe.add_to_cart_modal.keydown( event );
			return;
		}
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

/**
 * Detached session/controller for engine mode. Not inserted into `body`.
 * `PC.fe.ui` aliases `PC.fe.modal` — this is the session, not a fake window.
 */
PC.fe.views.stub_configurator = Backbone.View.extend({
	tagName: 'div',
	className: 'mkl_pc mkl_pc--headless',
	initialize: function( options ) {
		this.options = options || {};
		this.product_id = options.product_id;
		this.parent_id = options.parent_id;
		this.viewer = null;
		this.toolbar = null;
		this.footer = null;
		this.$main_window = $( '<div class="mkl_pc_container" />' );
		this.$el.append( this.$main_window );

		var data_key = 'prod_' + ( ( this.parent_id && 'async' !== PC.fe.config.data_mode ) ? this.parent_id : this.product_id );
		if ( PC.productData && PC.productData[ data_key ] && PC.productData[ data_key ].product_info ) {
			this.options = PC.productData[ data_key ].product_info;
		}
		return this;
	},
	open: function() {},
	close: function() {},
	remove: function() {
		this.$el.remove();
		this.stopListening();
		return this;
	},
	resetConfig: function() {
		PC.fe.reset_configuration();
	}
});

/**
 * THE VIEWER CONTRACT
 * ===================
 *
 * A viewer is whatever `PC.fe.viewer.main_view` resolves to: the default <img>
 * stack (PC.fe.views.viewer), the 3D viewer, or any future implementation
 * (canvas/WebGL, one-image-per-layer, ...). Everything outside the viewer must
 * go through this contract rather than reaching into the markup a particular
 * viewer happens to produce - DOM structure is an implementation detail, and
 * scraping it is what ties features to a single viewer.
 *
 * Required
 * --------
 * render() -> jQuery
 *     Build and return the viewer's root element.
 *
 * Optional, but needed for the feature in brackets
 * ------------------------------------------------
 * capture( options ) -> Promise<Blob|null>   [PDF, cart image, Save your design]
 *     Render the CURRENT configuration to a PNG blob, without disturbing what
 *     the user sees. Resolve null when capture is not possible, so callers can
 *     fall back rather than silently shipping a blank image. Options:
 *       { width, height, maxDimension }
 *     Implementations must decide what to draw from the MODELS (choice
 *     `active`, and `cshow` via PC.conditionalLogic.item_is_hidden), never from
 *     CSS classes such as `.active` / `.cshow-hidden` - those exist only in the
 *     default viewer's markup.
 *
 * captureScreenshot( options ) -> dataURL|null
 *     Legacy synchronous form, implemented by the 3D viewer. Supported by
 *     PC.fe.capture_viewer_image() for back-compat; new viewers should
 *     implement capture() instead.
 *
 * Notes
 * -----
 * - Multiple-choice layers can have several choices active at once, so a
 *   capture must iterate every active choice, not one per layer.
 * - Conditional logic sets `cshow` on the models; a viewer is responsible for
 *   reflecting that itself, rather than relying on an external toggle of its
 *   elements.
 */

/**
 * Capture the current configuration as a PNG blob, through the active viewer.
 *
 * This is the single entry point for anything that needs a picture of the
 * configuration (cart image, PDF, saved-design preview). It resolves null when
 * the viewer cannot produce one, leaving the decision to fall back - or to
 * surface an error - with the caller.
 *
 * @param {Object} [options] Passed through to the viewer: { width, height, maxDimension }.
 * @return {Promise<Blob|null>}
 */
PC.fe.capture_viewer_image = function( options ) {
	options = options || {};
	var viewer = PC.fe.modal && PC.fe.modal.viewer ? PC.fe.modal.viewer : null;

	/**
	 * Filter the viewer used for the capture, e.g. to capture something other
	 * than the currently mounted viewer.
	 *
	 * @param {Backbone.View|null} viewer
	 * @param {Object} options
	 */
	viewer = wp.hooks.applyFilters( 'PC.fe.capture.viewer', viewer, options );

	if ( ! viewer ) return Promise.resolve( null );

	// A capture that fails asynchronously must resolve null as well: callers await
	// this before the add to cart, and a rejection there stops the request itself.
	// fetch() of a data URL, for one, is refused under a CSP whose connect-src
	// does not allow data:.
	var on_failure = function( method ) {
		return function( err ) {
			console.log( 'Product configurator: viewer ' + method + ' failed.', err );
			return null;
		};
	};

	// Preferred: the viewer knows how to draw itself.
	if ( 'function' === typeof viewer.capture ) {
		try {
			return Promise.resolve( viewer.capture( options ) ).catch( on_failure( 'capture()' ) );
		} catch ( err ) {
			return Promise.resolve( on_failure( 'capture()' )( err ) );
		}
	}

	// Back-compat: the 3D viewer returns a data URL synchronously.
	if ( 'function' === typeof viewer.captureScreenshot ) {
		try {
			var data_url = viewer.captureScreenshot( options );
			if ( ! data_url ) return Promise.resolve( null );
			return fetch( data_url ).then( function( res ) { return res.blob(); } ).catch( on_failure( 'captureScreenshot()' ) );
		} catch ( err ) {
			return Promise.resolve( on_failure( 'captureScreenshot()' )( err ) );
		}
	}

	return Promise.resolve( null );
};

/**
 * Construct the viewer and optionally append it to `el`.
 * Uses filter `PC.fe.viewer.main_view` so 3D (and other) viewers still swap in.
 *
 * @param {Element|jQuery} [el]
 * @return {Backbone.View|null}
 */
PC.fe.mountViewer = function( el ) {
	var modal = PC.fe.modal;
	if ( ! modal ) {
		return null;
	}
	if ( modal.viewer ) {
		modal.viewer.remove();
		modal.viewer = null;
	}
	var Viewer_View = wp.hooks.applyFilters( 'PC.fe.viewer.main_view', PC.fe.views.viewer );
	modal.viewer = new Viewer_View( { parent: modal } );
	var $rendered = modal.viewer.render();
	if ( el ) {
		$( el ).append( $rendered );
	}
	return modal.viewer;
};

/**
 * Construct the toolbar and optionally append it to `el`.
 *
 * @param {Element|jQuery} [el]
 * @return {Backbone.View|null}
 */
PC.fe.mountToolbar = function( el ) {
	var modal = PC.fe.modal;
	if ( ! modal ) {
		return null;
	}
	if ( modal.toolbar ) {
		modal.toolbar.remove();
		modal.toolbar = null;
	}
	modal.toolbar = new PC.fe.views.toolbar( { parent: modal } );
	var $rendered = modal.toolbar.render();
	if ( el ) {
		$( el ).append( $rendered );
	}
	return modal.toolbar;
};

/**
 * Construct the footer and optionally append it to `el`.
 *
 * @param {Element|jQuery} [el]
 * @return {Backbone.View|null}
 */
PC.fe.mountFooter = function( el ) {
	var modal = PC.fe.modal;
	if ( ! modal ) {
		return null;
	}
	if ( modal.footer ) {
		modal.footer.remove();
		modal.footer = null;
	}
	modal.footer = new PC.fe.views.footer( { parent: modal } );
	var $rendered = modal.footer.render();
	if ( el ) {
		$( el ).append( $rendered );
	}
	return modal.footer;
};

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
		// The native quote request shares the class for its styles, and handles its own clicks.
		'click .add-to-quote:not(.mkl-pc-request-quote)': 'add_to_quote'
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
		
		// The YITH button is printed only for a product YITH would quote, and sends its own request, so it
		// does not depend on YITH's markup being on the page. The other quote plugins still do.
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).not( '.yith-raq, .mkl-pc-request-quote' ).remove();
		}
		if ( ! this.$cart.find( '.afrfqbt_single_page' ).length ) {
			this.$( '.add-to-quote' ).not( '.yith-raq, .mkl-pc-request-quote' ).html( this.$cart.find( '.afrfqbt_single_page' ).html() );
		}
		if ( this.$( '.yith-raq.add-to-quote' ).length && PC_config.config.ywraq_hide_add_to_cart ) {
			this.$( '.configurator-add-to-cart' ).remove();
		}

		if ( this.$( 'input.qty' ).length ) {
			// A view of PC.fe.get_qty(): it reports edits and redraws itself when
			// the quantity changes anywhere else, so it no longer has to be kept
			// in step with the product form's input by copying values across.
			PC.fe.bind_qty_input( this.$( 'input.qty' ) );
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

	validate_configuration: async function() {
		var result = await PC.fe.validate_configuration( { context: 'cart' } );
		return result.valid ? result.data : false;
	},
	
	populate_form_input: function( data, e ) {

		if ( PC.fe.config.cart_item_key && $( e.currentTarget ).is( '.edit-cart-item' ) ) {
			var $cart_item_field = this.$cart.find( 'input[name=pc_cart_item_key]' );
			if ( $cart_item_field ) $cart_item_field.val( PC.fe.config.cart_item_key );
		}

		$( 'input[name=pc_configurator_data]' ).val( data );
	},

	add_to_cart: async function( e ) {

		var data = await this.validate_configuration();
		
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

				// Cart image: ask the viewer for a picture of the configuration.
				var dataUrl = await this.capture_item_image();
				if ( dataUrl ) request_body.append( 'pc_3d_screenshot', dataUrl );

				/**
				 * Append extra multipart fields (add-ons). Default FormData is unchanged.
				 *
				 * @param {FormData} request_body Body sent to `pc_add_to_cart`.
				 * @param {Backbone.View} form_view This form view instance.
				 */
				wp.hooks.doAction( 'PC.fe.add_to_cart.append_ajax_request_body', request_body, this );

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
				} )
				.finally( () => {
					/**
					 * Run after ajax add-to-cart settles (success, error, or network failure).
					 *
					 * @param {Backbone.View} form_view This form view instance.
					 */
					wp.hooks.doAction( 'PC.fe.add_to_cart.ajax_request_finally', this );
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

	reset_after_ajax_add_to_cart: function() {
		if ( ! wp.hooks.applyFilters(
			'PC.fe.reset.on.ajax_add_to_cart',
			PC.fe.config.reset_configurator_on_ajax_add_to_cart,
			this
		) ) return;

		if ( PC.fe.modal ) {
			PC.fe.modal.resetConfig();
			PC.fe.save_data.reset_errors();
		}

		$( 'input[name=pc_configurator_data]' ).val( '' );

		var default_qty = PC.fe.currentProductData?.product_info?.qty_min_value || 1;
		PC.fe.set_qty( default_qty );
		wp.hooks.doAction( 'PC.fe.reset_after_ajax_add_to_cart', this );
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
		this.reset_after_ajax_add_to_cart();
	},
	
	add_to_quote: async function( e ) {

		var data = await this.validate_configuration();
		
		if ( ! data ) {
			return;
		}

		this.populate_form_input( data, e );

		wp.hooks.doAction( 'PC.fe.add_to_quote.before', this );

		if ( PC.fe.debug_configurator_data ) {
			console.log( 'debug_configurator_data', data );
			return;
		}

		// YITH: our own request, see add_to_yith_quote().
		if ( $( e.currentTarget ).is( '.yith-raq' ) ) {
			return this.add_to_yith_quote( data, $( e.currentTarget ) );
		}

		// The other quote plugins post the product form themselves, so the picture of the configuration
		// has to travel as a form field - there is no request body of ours to append it to.
		var dataUrl = await this.capture_item_image();
		if ( dataUrl ) this.set_quote_screenshot_field( dataUrl );

		// Woocommerce Add To Quote plugin
		if ( $( '.afrfqbt_single_page' ).length ) {
			$( '.afrfqbt_single_page' ).trigger( 'click' );
			if ( PC.fe.config.close_configurator_on_add_to_cart && ! PC.fe.inline ) PC.fe.modal.close();
		}
	},

	/**
	 * Add the configuration to the YITH quote list through pc_add_to_quote.
	 *
	 * Posts the configurator's form like the ajax add to cart does, so variation attributes and
	 * add-on fields come along, but needs nothing of YITH on the page. The configurator stays open
	 * until the answer is back, so a refusal is shown where the shopper can act on it.
	 *
	 * @param {string} data    Configuration JSON.
	 * @param {jQuery} $button The button clicked.
	 */
	add_to_yith_quote: async function( data, $button ) {
		if ( $button.hasClass( 'adding-to-quote' ) ) return;
		$button.addClass( 'adding-to-quote' ).prop( 'disabled', true );

		if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();
		PC.fe.add_to_cart_modal.show_template( 'mkl-pc-atq-adding' );

		var request_body = this.$cart && this.$cart.length ? new FormData( this.$cart[0] ) : new FormData();
		// Nothing here is an add to cart.
		request_body.delete( 'add-to-cart' );
		request_body.delete( 'pc_3d_screenshot' );
		request_body.set( 'product_id', PC.fe.active_product );
		request_body.set( 'pc_configurator_data', data );
		if ( 'function' === typeof PC.fe.get_qty ) request_body.set( 'quantity', PC.fe.get_qty() );

		var dataUrl = await this.capture_item_image();
		if ( dataUrl ) request_body.append( 'pc_3d_screenshot', dataUrl );

		/**
		 * Append extra multipart fields to the quote request.
		 *
		 * @param {FormData}      request_body Body sent to `pc_add_to_quote`.
		 * @param {Backbone.View} form_view    This form view instance.
		 */
		wp.hooks.doAction( 'PC.fe.add_to_quote.append_ajax_request_body', request_body, this );

		var response;
		try {
			var raw = await fetch( PC_config.ajaxurl + '?action=pc_add_to_quote', {
				method: 'POST',
				credentials: 'same-origin',
				body: request_body
			} );
			response = await raw.json();
		} catch ( error ) {
			console.error( 'Configurator: Error adding to the quote' );
			console.error( error );
			response = { result: 'error', message: '' };
		}

		$button.removeClass( 'adding-to-quote' ).prop( 'disabled', false );

		if ( ! response || 'error' === response.result || ! response.result ) {
			/**
			 * The configuration could not be added to the quote list.
			 *
			 * @param {Object}        response Server answer: result, message.
			 * @param {Backbone.View} form_view This form view instance.
			 */
			wp.hooks.doAction( 'PC.fe.add_to_quote.failed', response, this );
			$( document.body ).trigger( 'pc_not_added_to_quote', [ response ] );
			this.show_quote_error( response && response.message );
			return;
		}

		/**
		 * The configuration is in the quote list.
		 *
		 * @param {Object}        response Server answer: result (added|updated), message, item_key, list_url, count, redirect.
		 * @param {Backbone.View} form_view This form view instance.
		 */
		wp.hooks.doAction( 'PC.fe.add_to_quote.added', response, this );
		$( document.body ).trigger( 'pc_added_to_quote', [ response ] );

		// YITH's quote list widgets, when the page has them.
		if ( $.fn.ywraq_refresh_widget ) {
			var $widgets = $( '.widget_ywraq_list_quote, .widget_ywraq_mini_list_quote' );
			if ( $widgets.length ) $widgets.ywraq_refresh_widget();
		}

		if ( PC_config.config.ywraq_hide_add_to_cart && PC.fe.trigger_el && PC.fe.trigger_el[0] && 'button' === PC.fe.trigger_el[0].type ) {
			$( PC.fe.trigger_el[0] ).remove();
		}

		if ( response.redirect && response.list_url ) {
			PC.fe.add_to_cart_modal.show_template( 'mkl-pc-atq-redirect', response );
			window.location.href = response.list_url;
			return;
		}

		this.show_quote_count( $button, response.count );

		// The configurator stays open: the confirmation offers to keep configuring or to go to the list.
		PC.fe.add_to_cart_modal.show_template( 'mkl-pc-atq-added', response );
	},

	/**
	 * Show how many items the quote request holds, on the quote button.
	 *
	 * @param {jQuery} $button The quote button.
	 * @param {number} count   Items in the list.
	 */
	show_quote_count: function( $button, count ) {
		count = parseInt( count, 10 );
		var $badge = $button.find( '.pc-quote-count' );
		if ( ! count ) {
			$badge.remove();
			return;
		}
		if ( ! $badge.length ) {
			$badge = $( '<span class="pc-quote-count"></span>' ).appendTo( $button );
		}
		var labels = PC_config.config.ywraq_count_label || {};
		var label = ( ( 1 === count ? labels.one : labels.other ) || '%s' ).replace( '%s', count );
		$badge.text( count ).attr( 'title', label );
		$button.addClass( 'has-quote-items' ).attr( 'aria-description', label );
	},

	/**
	 * Show a quote refusal in the configurator, in the add to cart modal.
	 *
	 * @param {string} message HTML message from the server.
	 */
	show_quote_error: function( message ) {
		if ( ! PC.fe.add_to_cart_modal ) PC.fe.add_to_cart_modal = new PC.fe.views.add_to_cart_modal();
		PC.fe.add_to_cart_modal.show_template( 'mkl-pc-atc-not-added', { messages: message || PC_config.config.ywraq_error_message || '' } );
	},

	/**
	 * The picture that goes with a cart or quote item: a capture of the viewer, for 3D only.
	 *
	 * Goes through PC.fe.capture_viewer_image so any viewer that implements the capture contract
	 * works here, not just the 3D one.
	 *
	 * @return {Promise<string|null>} PNG data URL, or null.
	 */
	capture_item_image: async function() {
		if ( ! PC.fe.config.show_image_in_cart || ! PC.fe.currentProductData || ! PC.fe.currentProductData.product_info || PC.fe.currentProductData.product_info.configurator_type !== '3d' ) {
			return null;
		}
		var size = PC.fe.config.cart_screenshot_size || { width: 800, height: 800 };
		var blob = await PC.fe.capture_viewer_image( { view: 'current', width: size.width, height: size.height } );
		if ( ! blob ) return null;
		return new Promise( function( resolve ) {
			var reader = new FileReader();
			reader.onloadend = function() { resolve( reader.result ); };
			reader.onerror = function() { resolve( null ); };
			reader.readAsDataURL( blob );
		} );
	},
	/**
	 * Carry the viewer's picture in the product form, for quote plugins that serialize it.
	 *
	 * The field is only added once there is something to send, so a form without a
	 * configuration never posts an empty one.
	 *
	 * @param {string} data_url PNG data URL.
	 */
	set_quote_screenshot_field: function( data_url ) {
		if ( ! this.$cart || ! this.$cart.length ) return;
		var $field = this.$cart.find( 'input[name=pc_3d_screenshot]' );
		if ( ! $field.length ) {
			$field = $( '<input type="hidden" name="pc_3d_screenshot">' ).appendTo( this.$cart );
		}
		$field.val( data_url );
	},
	/**
	 * Kept for third-party code that calls it directly. The input itself is
	 * bound through PC.fe.bind_qty_input, and refreshing the displayed price now
	 * happens on PC.fe.qty_changed, so it runs whichever input was edited.
	 */
	qty_change: function( e ) {
		PC.fe.set_qty( $( e.target ).val(), { source: e.target } );
	}
} );

/*
	PC.fe.layer_masks
	-> Layer masks in the <img> stack: which mask a layer cuts its images with on
	   an angle, loading each mask once, and the CSS that applies it. See
	   docs/layer-masks-spec.md.

	A layer's `masks` is a list shaped like a choice's `images`:
	[ { angleId, image: { id, url, dimensions } } ]. An angle without an entry
	draws the layer unmasked.
*/
PC.fe.layer_masks = {

	/**
	 * Loads by URL: Promise<HTMLImageElement|null>.
	 */
	loads: {},

	/**
	 * The mask image of a layer on an angle.
	 *
	 * @param {Backbone.Model} layer
	 * @param {Number|String}  angle_id
	 * @return {Object|null} { id, url, dimensions }
	 */
	get: function( layer, angle_id ) {
		var masks = layer && layer.get( 'masks' );
		if ( ! _.isArray( masks ) || undefined === angle_id || null === angle_id ) return null;
		var mask = _.find( masks, function( item ) {
			return item && String( item.angleId ) === String( angle_id );
		} );
		return mask && mask.image && mask.image.url ? mask.image : null;
	},

	/**
	 * Load a mask once per page. Resolves the image, or null when it cannot be
	 * used: the layer is then drawn unmasked (decision 6 of the spec), which is
	 * easier to notice and debug than a layer that disappears.
	 *
	 * Loaded in CORS mode, like browsers fetch CSS mask images: a mask on another
	 * domain without CORS headers fails here exactly where the CSS mask would
	 * have hidden the image.
	 *
	 * @param {String} url
	 * @return {Promise<HTMLImageElement|null>}
	 */
	load: function( url ) {
		if ( this.loads[ url ] ) return this.loads[ url ];
		this.loads[ url ] = new Promise( function( resolve ) {
			var image = new Image();
			image.crossOrigin = 'anonymous';
			image.onload = function() {
				resolve( image );
			};
			image.onerror = function() {
				console.log( 'Product configurator: the layer mask ' + url + ' could not be loaded, the layer is drawn unmasked.' );
				resolve( null );
			};
			image.src = url;
		} );
		return this.loads[ url ];
	},

	/**
	 * Set the CSS mask of an element, or clear it with a falsy url.
	 *
	 * `contain` + `center`: the core themes size a layer image's box to the drawn
	 * image, so a mask of the same proportions covers it exactly (also under
	 * `object-fit: contain`). Both spellings: Safari before 15.4 only knows the
	 * prefixed ones.
	 *
	 * @param {HTMLElement} el
	 * @param {String|null} url
	 */
	apply: function( el, url ) {
		var value = url ? 'url("' + String( url ).replace( /"/g, '%22' ) + '")' : '';
		_.each( [ '', '-webkit-' ], function( prefix ) {
			el.style.setProperty( prefix + 'mask-image', value );
			el.style.setProperty( prefix + 'mask-size', url ? 'contain' : '' );
			el.style.setProperty( prefix + 'mask-position', url ? 'center' : '' );
			el.style.setProperty( prefix + 'mask-repeat', url ? 'no-repeat' : '' );
		} );
	},

	/**
	 * Give a layer view's <img> its src, masked for the active angle.
	 *
	 * With a mask, the src is only set once the mask is loaded and applied: until
	 * then the image keeps its loading state, so the stack never shows it uncut
	 * (a fabric covering a whole shirt), and an image pool keeps the previous
	 * image meanwhile. Without one, the src is set at once, as before.
	 *
	 * The view keeps the loaded mask in `mask_image`, for capture(), and the
	 * URL of the mask last asked for in `mask_url` (mask_changed()).
	 *
	 * @param {Backbone.View}  view     viewer_layer or viewer_static_layer.
	 * @param {Backbone.Model} layer
	 * @param {String}         src
	 * @param {Boolean}        keep_src Only bring the mask in line: the image
	 *                                  already shows src (a static layer with
	 *                                  the same file on another view). Setting
	 *                                  it again could wait for a load event that
	 *                                  never comes.
	 */
	set_src: function( view, layer, src, keep_src ) {
		var token = view.mask_token = {};
		var mask = this.mask_for( layer, src );
		view.mask_url = mask ? mask.url : '';

		if ( ! mask ) {
			if ( view.mask_image || view.el.style.getPropertyValue( 'mask-image' ) || view.el.style.getPropertyValue( '-webkit-mask-image' ) ) this.apply( view.el, null );
			view.mask_image = null;
			if ( ! keep_src ) view.el.src = src;
			return;
		}

		var that = this;
		this.load( mask.url ).then( function( image ) {
			// Asked again meanwhile (an angle change), or gone.
			if ( view.mask_token !== token || view.is_removed || view.is_retired ) return;
			that.apply( view.el, image ? mask.url : null );
			view.mask_image = image;
			if ( ! keep_src ) view.el.src = src;
		} );
	},

	/**
	 * The mask an image of a layer is cut with on the active angle, if any.
	 * The transparent placeholder has nothing to cut; a colour fill does
	 * (choice-color.js).
	 *
	 * @return {Object|null} { id, url, dimensions }
	 */
	mask_for: function( layer, src ) {
		if ( ! src ) return null;
		if ( 0 === src.indexOf( 'data:' ) && ! ( PC.fe.choice_color && PC.fe.choice_color.is_fill_url( src ) ) ) return null;
		var angle = PC.fe.angles.findWhere( { active: true } );
		return this.get( layer, angle && angle.id );
	},

	/**
	 * Whether the mask a view should show on the active angle is not the one
	 * it last asked for.
	 *
	 * @param {Backbone.View}  view
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	mask_changed: function( view, layer ) {
		var mask = this.mask_for( layer, view.el.getAttribute( 'src' ) );
		return ( mask ? mask.url : '' ) !== ( view.mask_url || '' );
	},

	/**
	 * Draw an image cut by its mask, for capture(): both stretched to the same
	 * rectangle, as the image alone would be.
	 *
	 * @param {CanvasRenderingContext2D} ctx
	 * @param {HTMLImageElement|HTMLCanvasElement} source
	 * @param {HTMLImageElement} mask
	 * @param {Number} width
	 * @param {Number} height
	 */
	draw_masked: function( ctx, source, mask, width, height ) {
		var scratch = document.createElement( 'canvas' );
		scratch.width = width;
		scratch.height = height;
		var scratch_ctx = scratch.getContext( '2d' );
		scratch_ctx.drawImage( source, 0, 0, width, height );
		scratch_ctx.globalCompositeOperation = 'destination-in';
		scratch_ctx.drawImage( mask, 0, 0, width, height );
		ctx.drawImage( scratch, 0, 0 );
	},
};

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
		this.items = [];
		// Layer id -> rendered view, and layer id -> position in the sorted
		// collection. See insert() for why the position has to be remembered.
		this.views = {};
		this.order_index = {};
		this.has_deferred_layers = false;
		this.render();
		this.listenTo( PC.fe.layers, 'change active', this.activate );
		// A layer whose render was skipped has to be built the first time
		// conditional logic reveals it.
		this.listenTo( PC.fe.layers, 'change:cshow', this.build_revealed_layers );
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

	/**
	 * Whether layers that conditional logic hides should be left unrendered until
	 * they are first shown.
	 *
	 * On large configurations most layers are hidden when the configurator opens,
	 * so building their markup only to hide it immediately afterwards is the
	 * single biggest cost of opening. This is only correct because the first
	 * conditions run happens before any view is built - see
	 * PC.fe.prepare_initial_state().
	 *
	 * Off unless something turns it on: the conditional logic add-on sets
	 * `defer_hidden_layers` from its own setting, which is on for new stores and
	 * off for existing ones - a store may have styling that counts on every layer
	 * being in the page (sibling combinators, :nth-child), or a customisation that
	 * expects 'PC.fe.layers_list_item.init' to fire for every layer as the
	 * configurator opens.
	 *
	 * Force it either way with:
	 *   wp.hooks.addFilter( 'PC.fe.defer_hidden_layers', 'my-theme', function() { return true; } );
	 *
	 * @return {Boolean}
	 */
	defer_hidden_layers: function() {
		var enabled = !! PC_config.config.defer_hidden_layers;
		return !! wp.hooks.applyFilters( 'PC.fe.defer_hidden_layers', enabled, this );
	},

	/**
	 * Whether conditional logic currently hides this layer, on its own account or
	 * through an ancestor. Read from the models, so the answer does not depend on
	 * markup that may not exist yet.
	 *
	 * @param {Backbone.Model} model
	 * @return {Boolean}
	 */
	is_hidden_by_conditions: function( model ) {
		if ( false === model.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( model );
		}
		return false;
	},

	add_all: function( collection ) { 
		this.$el.empty();
		this.items = [];
		this.views = {};
		this.order_index = {};
		this.has_deferred_layers = false;
		collection.orderBy = 'order';
		collection.sort();
		if ( PC_config.config.use_steps ) PC.fe.steps.setup_steps();

		// Remember where each layer sits in the sorted collection. Other views
		// re-sort the same collection (the viewer orders it by image_order), so a
		// layer built later cannot ask the collection where it belongs: it asks
		// this instead.
		collection.each( function( model, index ) {
			this.order_index[ model.id ] = index;
		}, this );

		var defer = this.defer_hidden_layers();
		collection.each( function( model ) {
			if ( defer && this.is_hidden_by_conditions( model ) ) {
				this.has_deferred_layers = true;
				return;
			}
			this.add_one( model );
		}, this );

		wp.hooks.doAction( 'PC.fe.layers_list.layers.added', this );
	},

	/**
	 * Build the layers that were skipped and are now visible.
	 *
	 * Revealing a group also reveals its children, whose own `cshow` never
	 * changed, so this walks every layer rather than reacting to the one model
	 * that changed. Layers are walked in list order so a group is always built
	 * before the children that go inside it.
	 */
	build_revealed_layers: function() {
		if ( ! this.has_deferred_layers ) return;

		var that = this;
		var pending = _.sortBy( PC.fe.layers.filter( function( model ) {
			return ! that.views[ model.id ];
		} ), function( model ) {
			var index = that.order_index[ model.id ];
			return ( 'undefined' === typeof index ) ? Number.MAX_VALUE : index;
		} );

		var built = [];
		var still_deferred = false;

		_.each( pending, function( model ) {
			if ( that.is_hidden_by_conditions( model ) ) {
				still_deferred = true;
				return;
			}
			var view = that.add_one( model );
			if ( view ) built.push( view );
		} );

		this.has_deferred_layers = still_deferred;

		if ( built.length ) {
			/**
			 * Layers that were not rendered when the configurator opened have just
			 * been added to the list.
			 *
			 * @param {PC.fe.views.layers_list} list
			 * @param {Array} views The layer views that were just built.
			 */
			wp.hooks.doAction( 'PC.fe.layers_list.layers.added.deferred', this, built );
		}
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

		if ( ! new_layer ) return false;

		this.insert( model, new_layer );

		// add to a new collection to be used to render the viewer
		this.items.push( new_layer );
		this.views[ model.id ] = new_layer;

		return new_layer;
	},

	/**
	 * The list a layer's item belongs in: the nested list of its group parent when
	 * it has one, the main list otherwise.
	 *
	 * @param {Backbone.Model} model
	 * @return {jQuery}
	 */
	get_container: function( model ) {
		var parent_id = model.get( 'parent' );
		var parent = parent_id ? model.collection.get( parent_id ) : false;
		if ( parent && 'group' == parent.get( 'type' ) ) {
			var $group_list = this.options.parent.$( 'ul[data-layer-id=' + parent_id + ']' );
			if ( $group_list.length ) return $group_list;
		}
		return this.$el;
	},

	/**
	 * Put a layer where it belongs in the list rather than at the end.
	 *
	 * add_all() walks the collection in order, so appending would be enough for
	 * the opening pass - but a deferred layer is built whenever conditional logic
	 * reveals it, long after the layers around it. Its place comes from the order
	 * recorded in add_all(), resolved against the siblings that are actually
	 * present: the item goes before the first sibling that comes after it, and at
	 * the end when there is none.
	 *
	 * @param {Backbone.Model} model
	 * @param {Backbone.View} view
	 */
	insert: function( model, view ) {
		var $container = this.get_container( model );

		view.render();
		// Every item carries its layer id, whatever view rendered it, so the next
		// one can find its place among them.
		view.$el.attr( 'data-layer', model.id );

		var index = this.order_index[ model.id ];
		if ( 'undefined' !== typeof index ) {
			var that = this;
			var $before = null;

			$container.children( '[data-layer]' ).each( function() {
				var sibling_index = that.order_index[ $( this ).attr( 'data-layer' ) ];
				if ( 'undefined' === typeof sibling_index ) return;
				if ( sibling_index > index ) {
					$before = $( this );
					return false;
				}
			} );

			if ( $before ) {
				$before.before( view.$el );
				return;
			}
		}

		$container.append( view.$el );
	},

	activate: function( model ) {
		if ( model.get( 'active' ) == false ) {
			if ( model.collection.findWhere( { 'active': true } ) ) {
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
	/**
	 * What the data is saved for, read by add-ons while choices are parsed: 'cart', 'quote', or '' (steps, designs...).
	 */
	context: '',
	save: function( reset_errors, context ) {
		this.context = context || '';
		if ( false !== reset_errors ) this.reset_errors();
		this.choices = [];
		PC.fe.layers.each( this.parse_choices, this ); 
		// The saved names are in the language the customer configured in. Record it, so the
		// order can be displayed in another language (eg. the admin's) from the product data.
		if ( PC.fe.lang ) {
			_.each( this.choices, function( choice ) {
				if ( choice && 'object' === typeof choice && ! choice.lang ) choice.lang = PC.fe.lang;
			} );
		}
		this.choices = wp.hooks.applyFilters( 'PC.fe.save_data.choices', this.choices );
		return JSON.stringify( this.choices );
	},
	/**
	 * Async variant: runs "before save" promises (plugins inject via PC.fe.save_data.before_save.promises),
	 * then calls save(). Use for add-to-cart / add-to-quote so plugins can e.g. export base64 first.
	 */
	getSaveDataAsync: async function( reset_errors, context ) {
		var promises = wp.hooks.applyFilters( 'PC.fe.save_data.before_save.promises', [] );
		await Promise.all( promises );
		return this.save( reset_errors, context );
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
		this.context = '';
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
	/**
	 * The angle the cart image is built from: the active one when "Use the active angle to generate
	 * the image in the cart" is on, otherwise the one set to be used in the cart, or the first.
	 *
	 * @return {Backbone.Model|undefined}
	 */
	get_cart_angle: function() {
		if ( PC.fe.config.angles.save_current ) {
			var angle = PC.fe.angles.findWhere( 'active', true );
		} else {
			var angle = PC.fe.angles.findWhere( 'use_in_cart', true );
		}
		return angle || PC.fe.angles.first();
	},
	/**
	 * The ID of the angle saved with the configuration. Every layer of the cart image must come from
	 * it, so add-ons rendering their own layer image (e.g. Text overlay) should use this too.
	 *
	 * @return {Number|undefined}
	 */
	get_cart_angle_id: function() {
		var angle = PC.fe.save_data.get_cart_angle();
		return wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.angle_id', angle ? angle.id : undefined );
	},
	/**
	 * The mask a layer cuts its images with on an angle (docs/layer-masks-spec.md).
	 *
	 * Saved with each choice, next to its image, so the order keeps the mask it was placed
	 * with when the layer's masks change later.
	 *
	 * @param {Backbone.Model} layer
	 * @param {Number|String}  angle_id
	 * @return {Number} Attachment id, 0 for none.
	 */
	get_mask_id: function( layer, angle_id ) {
		var masks = layer.get( 'masks' );
		if ( ! _.isArray( masks ) || undefined === angle_id ) return 0;
		var mask = _.find( masks, function( item ) {
			return item && String( item.angleId ) === String( angle_id );
		} );
		var id = mask && mask.image ? parseInt( mask.image.id, 10 ) : 0;
		return id > 0 ? id : 0;
	},
	// get choices for one layer
	parse_choices: function( model ) {
		var is_required = parseInt( model.get( 'required' ) );
		var default_selection = model.get( 'default_selection' ) || 'select_first';
		var type = model.get( 'type' );

		// If the layer is hidden, ignore it
		if ( false === model.get( 'cshow' ) ) return;

		if ( 'form' == type || 'group' == type ) is_required = false;

		var model_data = wp.hooks.applyFilters( 'PC.fe.configurator.layer_data', model.attributes );
		var angle_id = PC.fe.save_data.get_cart_angle_id();
		// Save where the layer sits in the merged image, so the stacking order of a saved
		// configuration survives the layers being reordered later. `image_order` is only set on
		// the layers that are composited out of the layer order.
		// The cart view's own order when it has one (canvas viewer): the server composes that view.
		var view_order = PC.fe.viewer_state ? PC.fe.viewer_state.view_image_order( model, angle_id ) : null;
		var image_order = null !== view_order ? view_order : parseInt( model_data.image_order, 10 );
		if ( isNaN( image_order ) ) image_order = parseInt( model_data.order, 10 );
		if ( isNaN( image_order ) ) image_order = 0;
		image_order = wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.image_order', image_order, model );
		var mask_id = PC.fe.save_data.get_mask_id( model, angle_id );

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
						image_order: image_order,
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

					// An image id, or the choice's colour (docs/solid-colour-choices-spec.md).
					var img_id = PC.fe.choice_color.saved_image( choice, angle_id );
					var choice_data = {
						is_choice: true,
						layer_id: model.id,
						choice_id: choice.id,
						angle_id: angle_id,
						image_order: image_order,
						layer_name: model_data.name,
						image: img_id,
						name: choice.get_name(),
					};
					if ( choice.get( 'sku' ) ) choice_data.sku = choice.get( 'sku' );
					if ( mask_id && img_id ) choice_data.mask = mask_id;
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
					// An image id, or the choice's colour (docs/solid-colour-choices-spec.md).
					var img_id = PC.fe.choice_color.saved_image( choice, angle_id );
					const choice_data = {
						is_choice: true,
						layer_id: model.id, 
						choice_id: choice.id, 
						angle_id: angle_id,
						image_order: image_order,
						image: img_id,
						layer_name: model_data.name,
						name: choice.get_name(),
					};
					if ( mask_id && img_id ) choice_data.mask = mask_id;
				
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
			var img_id = choice.get_image( 'image', 'id', angle_id );
			var static_data = {
				is_choice: false,
				layer_id: model.id,
				choice_id: choice.id,
				angle_id: angle_id,
				image_order: image_order,
				image: img_id,
				name: choice.get_name(),
			};
			if ( mask_id && img_id ) static_data.mask = mask_id;
			if ( wp.hooks.applyFilters( 'PC.fe.save_data.parse_choices.add_choice', true, choice ) ) this.choices.push(
				wp.hooks.applyFilters(
					'PC.fe.save_data.parse_choices.added_choice',
					static_data
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

		if ( PC.fe.modal && PC.fe.modal.$el ) {
			PC.fe.modal.$el.addClass( 'has-steps' );
		}

		// add buttons
		if ( this.initialized ) return;

		wp.hooks.addAction( 'PC.fe.start', 'mkl/product_configurator/steps', function( modal ) {
			if  ( ! PC.fe.use_steps || ! this.steps ) return;
			if ( ! modal || ! modal.footer || ! modal.toolbar ) return;
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
		if ( ! this.current_step || ! this.$live ) return;
		const current_step = this.get_index( this.current_step );
		const total_steps = PC.fe.steps.steps.length;
		const step_number = current_step + 1;
		const step_name = this.current_step.get( 'name' );
		const step_label = PC_config.lang.steps_progress_current_step.replace( '%1$s', step_number ).replace( '%2$s', total_steps ).replace( '%3$s', step_name );
		this.$live.text( step_label );
	},
	clean_existing_steps: function() {
		if ( this.steps ) this.steps = null;
		if ( PC.fe.modal && PC.fe.modal.$el ) {
			PC.fe.modal.$el.removeClass( 'has-steps' );
			PC.fe.modal.$el.removeClass( 'last-step' );
			PC.fe.modal.$el.removeClass( 'first-step' );
		}
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

		if ( PC.fe.modal && PC.fe.modal.$el ) {
			PC.fe.modal.$el.toggleClass( 'last-step', !! ( current_index == steps.length - 1 ) );
			PC.fe.modal.$el.toggleClass( 'first-step', 0 == current_index );

			if ( PC_config.config.open_first_layer && PC.fe.modal.$el.is( '.float, .wsb' ) ) {
				setTimeout( function() {
					var $first = PC.fe.modal.$( '.type-step.active button.layer-item:visible' ).first();
					if ( ! $first.parent().is( '.display-mode-dropdown' ) ) $first.trigger( 'click' );
				}, 50 );
			}
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

/*
	PC.fe.views.viewer_canvas
	-> The 2D viewer drawn with Pixi: every layer in one canvas instead of one
	   <img> per layer. See docs/canvas-viewer-spec.md.

	Chosen with the `viewer_2d_renderer` setting (PC.fe.config.viewer_2d_renderer)
	and the `PC.fe.viewer.renderer` filter. Whenever it cannot show a product
	correctly - no WebGL, an add-on drawing a layer as DOM, an image it is not
	allowed to read, a lost context - the <img> stack is used instead.
*/

/**
 * Pick the canvas viewer for 2D products when the renderer says so.
 *
 * Runs after the 3D filter (priority 10), and only replaces the default <img>
 * stack: a 3D product, or any other viewer an add-on chose, is left alone.
 */
wp.hooks.addFilter( 'PC.fe.viewer.main_view', 'PC.fe.canvas', function( View ) {
	var Canvas_View = PC.fe.views.viewer_canvas;
	if ( View !== PC.fe.views.viewer ) return View;
	if ( 'canvas' !== Canvas_View.renderer() ) return View;
	// Already given up on this page view, and already reported.
	if ( Canvas_View.disabled ) return View;

	var unsupported = Canvas_View.unsupported_reason();
	if ( unsupported ) {
		// Missing Pixi or WebGL will not change on this page; a DOM-drawn layer
		// belongs to this product only.
		if ( 'dom_item_view' !== unsupported.reason ) Canvas_View.disabled = unsupported;
		Canvas_View.report_fallback( unsupported.reason, unsupported.detail, null );
		return View;
	}
	return Canvas_View;
}, 20 );

PC.fe.views.viewer_canvas = Backbone.View.extend( {
	tagName: 'div',
	className: 'mkl_pc_viewer mkl_pc_viewer--canvas',
	template: wp.template( 'mkl-pc-configurator-viewer' ),
	imagesLoading: 0,

	initialize: function( options ) {
		this.parent = options.parent || PC.fe;
		this.imagesLoading = 0;
		this.app = null;
		this.stacks = {};
		// The stack on screen, and the one being prepared to replace it.
		this.current_stack = null;
		this.target_stack = null;
		this.angle_wait_timer = null;
		// Loaded textures by URL: see load_texture().
		this.textures = {};
		this.texture_clock = 0;
		this.url_bucket = null;
		this.resolution_timer = null;
		this.background = null;
		// Full-size decodes in flight, and the ones waiting: see decode_slot().
		this.decoding = 0;
		this.decode_queue = [];
		// Entries waiting for a texture, by URL: they pin it (is_pinned()).
		this.waiting = {};
		// Flat copies of left angles, by angle id; the one drawn in place of
		// the current stack, if any; the angle transition running. See the
		// Snapshots section of docs/canvas-viewer-spec.md.
		this.snapshots = {};
		this.cover = null;
		this.transition = null;
		// How the angles not shown are kept (phase 4b): 'live', 'refresh' or
		// 'reload'. See update_mode().
		this.mode = 'refresh';
		this.picture_bytes = 0;
		this.live_blocked = false;
		this.background_dirty = false;
		this.idle_timer = null;
		this.refresh_job = null;
		this.show_clock = 0;
		this.html_items = [];
		// Add-on items drawn in the scene, by choice key (canvas_item()), and
		// the ones that changed since the last frame.
		this.items = {};
		this.dirty_items = [];
		this.pending_layers = {};
		this.sync_scheduled = false;
		this.render_frame = null;
		this.context_timer = null;
		this.resize_observer = null;
		this.is_loading = false;
		this.is_removed = false;
		this.own_children = [];
		this.ready = Promise.resolve();
		return this;
	},

	render: function() {
		wp.hooks.doAction( 'PC.fe.viewer.render.before', this );

		this.$el.append( this.template() );

		if ( ! PC.fe.contents ) {
			console.log( 'no content to show.' );
			wp.hooks.doAction( 'PC.fe.viewer.render', this );
			return this.$el;
		}

		if ( PC.fe.angles.length > 1 ) {
			this.angles_selector = new PC.fe.views.angles( { parent: this } );
			this.$el.append( this.angles_selector.render() );
		} else if ( PC.fe.angles.length ) {
			PC.fe.angles.first().set( 'active', true );
		} else {
			console.error( 'Product configurator: there are no angles set. Please complete the product setup.' );
			return this.$el;
		}

		this.$layers = this.$el.find( '.mkl_pc_layers' );

		// Themes show their loading indicator with `img.loading ~ .images-loading`;
		// this hidden image carries the `loading` class while the picture loads.
		this.$loading_marker = $( '<img class="mkl_pc_canvas_marker" alt="" aria-hidden="true" />' ).css( { visibility: 'hidden', pointerEvents: 'none' } );
		this.$loader = $( '<div class="images-loading" />' );
		this.$layers.append( this.$loading_marker, this.$loader );

		this.add_html_items();
		this.ready = this.start();

		wp.hooks.doAction( 'PC.fe.viewer.render', this );

		// Anything appended to the root after this (the toolbar of an empty
		// configurator, a loading message) is moved along if the viewer is swapped.
		this.own_children = this.$el.children().toArray();

		return this.$el;
	},

	/**
	 * Create the Pixi application, then draw the active angle.
	 *
	 * @return {Promise}
	 */
	start: async function() {
		// Pixi is loaded on demand (load_pixi()), unless something on the page already did.
		var loaded = await PC.fe.views.viewer_canvas.load_pixi();
		if ( this.is_removed ) return;
		if ( ! loaded ) {
			this.fall_back( 'pixi_missing' );
			return;
		}
		if ( PIXI.isWebGLSupported && ! PIXI.isWebGLSupported() ) {
			this.fall_back( 'webgl' );
			return;
		}
		var app = new PIXI.Application();
		var container = this.$layers.get( 0 );
		try {
			await app.init( {
				width: Math.max( 1, container.clientWidth ),
				height: Math.max( 1, container.clientHeight ),
				backgroundAlpha: 0,
				antialias: true,
				autoDensity: true,
				autoStart: false,
				resolution: Math.min( window.devicePixelRatio || 1, 2 ),
				preference: 'webgl',
				// The viewer manages its textures itself (texture_budget()), and
				// frees their images once uploaded (free_source()): Pixi's
				// collector would unload an idle texture from the GPU and upload
				// it again from an image that is gone.
				gcActive: false,
			} );
		} catch ( error ) {
			this.fall_back( 'webgl', error );
			return;
		}

		if ( this.is_removed ) {
			app.destroy( { removeView: true }, { children: true } );
			return;
		}

		this.app = app;
		var canvas = app.canvas;
		canvas.className = 'mkl_pc_canvas';
		canvas.setAttribute( 'aria-hidden', 'true' );
		$( canvas ).css( { position: 'absolute', top: 0, left: 0, display: 'block', pointerEvents: 'none' } );
		this.$layers.prepend( canvas );

		this.on_context_lost = this.on_context_lost.bind( this );
		this.on_context_restored = this.on_context_restored.bind( this );
		canvas.addEventListener( 'webglcontextlost', this.on_context_lost );
		canvas.addEventListener( 'webglcontextrestored', this.on_context_restored );

		if ( window.ResizeObserver ) {
			this.resize_observer = new ResizeObserver( this.on_resize.bind( this ) );
			this.resize_observer.observe( container );
		}

		this.listen_to_models();

		var active = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		if ( active ) this.show_angle( active.id );
		this.on_resize();
	},

	listen_to_models: function() {
		this.listenTo( PC.fe.angles, 'change:active', this.on_angle_change );
		// Any layer's visibility can hide another through a group, so a layer
		// change resyncs every layer, as the image pools do.
		this.listenTo( PC.fe.layers, 'change:cshow', this.schedule_sync_all );
		PC.fe.layers.each( function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			this.listenTo( choices, 'change:active change:cshow', function() {
				this.schedule_sync( layer.id );
			} );
			// Hovering or focusing a choice (choice.js).
			this.listenTo( choices, 'preload-image', this.preload );
		}, this );
	},

	/**
	 * Key of a choice in the scene. Choice ids repeat across layers.
	 */
	view_key: function( choice ) {
		return choice.get( 'layerId' ) + ':' + choice.id;
	},

	/**
	 * The add-on item drawing a choice in the scene, or null for a plain image.
	 * Asked once per choice and viewer. See the Add-ons section of
	 * docs/canvas-viewer-spec.md.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Object|null}
	 */
	canvas_item: function( choice ) {
		var key = this.view_key( choice );
		if ( key in this.items ) return this.items[ key ];
		var item = PC.fe.views.viewer_canvas.ask_item( choice, this.item_context( choice ) );
		this.items[ key ] = item;
		return item;
	},

	/**
	 * What an item gets to talk to the viewer.
	 */
	item_context: function( choice ) {
		var that = this;
		var item = null;
		return {
			viewer: this,
			layer: PC.fe.layers.get( choice.get( 'layerId' ) ) || null,
			// The item changed: update() runs on each of its containers before
			// the next frame is drawn.
			request_render: function() {
				item = item || that.items[ that.view_key( choice ) ];
				if ( item ) that.item_changed( item );
			},
		};
	},

	/**
	 * What the viewer passes to an item's create() and update() for a stack.
	 *
	 * resolution: device pixels per pixel of the angle's image, so text is
	 * rasterised as sharp as it is shown.
	 */
	item_options: function( stack ) {
		var renderer = this.app && this.app.renderer;
		var scale = stack.container.scale.x || 1;
		return {
			size: stack.size,
			resolution: scale * ( renderer ? renderer.resolution : 1 ),
			capture: false,
		};
	},

	item_changed: function( item ) {
		if ( this.is_removed ) return;
		if ( -1 === this.dirty_items.indexOf( item ) ) this.dirty_items.push( item );
		this.note_activity();
		// Other angles' snapshots may now be stale: the idle refresh redraws them.
		this.background_dirty = true;
		this.after_change();
	},

	/**
	 * Run update() on the containers of the items that changed.
	 */
	apply_item_updates: function() {
		if ( ! this.dirty_items.length ) return;
		var dirty = this.dirty_items;
		this.dirty_items = [];
		this.each_item_entry( function( entry, stack ) {
			if ( -1 === dirty.indexOf( entry.item ) ) return;
			this.update_item_entry( entry, stack );
		} );
	},

	update_item_entry: function( entry, stack, options ) {
		if ( ! entry.sprite || ! entry.item.update ) return;
		options = options || this.item_options( stack );
		entry.item_resolution = options.resolution;
		entry.item_size = options.size;
		try {
			entry.item.update( entry.sprite, stack.angle_id, options );
		} catch ( error ) {
			console.log( 'Product configurator: an add-on item could not update.', error );
		}
	},

	each_item_entry: function( callback ) {
		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				_.each( record.shown, function( entry ) {
					if ( entry.item ) callback.call( this, entry, stack );
				}, this );
			}, this );
		}, this );
	},

	/**
	 * The image a choice shows at an angle, or '' when it has none there.
	 *
	 * The responsive pick is the <img> stack's (viewer_layer.render()), on the
	 * same width, so both viewers request the same files.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number|String} angle_id
	 * @return {String}
	 */
	image_url: function( choice, angle_id ) {
		var bucket = this.image_bucket();
		if ( 'mobile' === bucket && choice.get_image( 'image', 'url_mobile', angle_id ) ) {
			return choice.get_image( 'image', 'url_mobile', angle_id );
		}
		if ( 'large' === bucket && choice.get_image( 'image', 'url_large', angle_id ) ) {
			return choice.get_image( 'image', 'url_large', angle_id );
		}
		return choice.get_image( 'image', 'url', angle_id ) || '';
	},

	/**
	 * Which image size the breakpoints ask for: mobile, default or large.
	 *
	 * @return {String}
	 */
	image_bucket: function() {
		var config = PC.fe.config || {};
		var width = PC.fe.modal && PC.fe.modal.$el ? PC.fe.modal.$el.outerWidth() : 0;
		if ( width && config.mobile_image_breakpoint && width < config.mobile_image_breakpoint ) return 'mobile';
		if ( width && config.large_image_breakpoint && width >= config.large_image_breakpoint ) return 'large';
		return 'default';
	},

	/**
	 * The size the images of an angle are authored at, from the stored image
	 * dimensions. Null when none are stored: the first texture decides then.
	 */
	angle_size: function( angle_id ) {
		var size = null;
		_.find( PC.fe.viewer_state.layers_in_image_order(), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return false;
			var found = choices.find( function( choice ) {
				var dimensions = choice.get( 'images' ) && choice.get_image( 'image', 'dimensions', angle_id );
				return dimensions && 0 < parseInt( dimensions.width ) && 0 < parseInt( dimensions.height );
			} );
			if ( ! found ) return false;
			var dimensions = found.get_image( 'image', 'dimensions', angle_id );
			size = { width: parseInt( dimensions.width ), height: parseInt( dimensions.height ) };
			return true;
		} );
		return size;
	},

	/*
	 * Stacks: one per angle shown so far.
	 * --------------------------------------------------------------------- */

	ensure_stack: function( angle_id ) {
		if ( this.stacks[ angle_id ] ) return this.stacks[ angle_id ];

		var stack = {
			angle_id: angle_id,
			container: new PIXI.Container(),
			layers: {},
			size: this.angle_size( angle_id ),
			probe: null,
			probe_ready: false,
		};
		stack.container.sortableChildren = true;
		stack.container.visible = false;
		// What angle transitions move and fade; layout() places the container
		// inside it, so the two never fight over the position.
		stack.frame = new PIXI.Container();
		stack.frame.addChild( stack.container );
		this.app.stage.addChild( stack.frame );

		// In the view's own order when it has one: each view keeps its stack, so a view's
		// order is set once, here, and switching views reorders nothing.
		_.each( PC.fe.viewer_state.layers_in_image_order( angle_id ), function( layer, index ) {
			var node = new PIXI.Container();
			node.sortableChildren = true;
			node.zIndex = index;
			stack.container.addChild( node );
			stack.layers[ layer.id ] = { layer: layer, node: node, shown: {}, held: [], hold_timer: null, mask: null, item_masks: {} };
		} );

		if ( stack.size ) this.add_probe( stack );
		this.stacks[ angle_id ] = stack;
		return stack;
	},

	/**
	 * A hidden image of the angle's size, laid out by the theme's own rules for
	 * layer images. Where it lands is where the picture is drawn, so the canvas
	 * matches the <img> stack whatever the theme does with it.
	 */
	add_probe: function( stack ) {
		var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + stack.size.width + '" height="' + stack.size.height + '"/>';
		var probe = document.createElement( 'img' );
		probe.className = 'mkl_pc_canvas_probe';
		probe.alt = '';
		probe.setAttribute( 'aria-hidden', 'true' );
		probe.style.visibility = 'hidden';
		probe.style.pointerEvents = 'none';
		this.$loading_marker.before( probe );
		stack.probe = probe;

		var that = this;
		var ready = function() {
			stack.probe_ready = true;
			if ( that.is_removed ) return;
			that.layout();
			that.request_render();
		};
		probe.onload = ready;
		probe.onerror = ready;
		probe.src = 'data:image/svg+xml,' + encodeURIComponent( svg );
	},

	/**
	 * Place every stack where its probe sits.
	 */
	layout: function() {
		if ( ! this.app ) return;
		var container = this.$layers.get( 0 );
		var box = container.getBoundingClientRect();
		_.each( this.stacks, function( stack ) {
			if ( ! stack.size ) return;
			var rect = stack.probe_ready ? stack.probe.getBoundingClientRect() : null;
			if ( rect && rect.width && rect.height ) {
				stack.container.position.set( rect.left - box.left, rect.top - box.top );
				stack.container.scale.set( rect.width / stack.size.width, rect.height / stack.size.height );
				return;
			}
			// The probe is not laid out (hidden by a stylesheet, or still
			// loading): fit inside the viewer without upscaling, centred.
			var width = container.clientWidth;
			var height = container.clientHeight;
			var scale = Math.min( 1, width / stack.size.width, height / stack.size.height );
			stack.container.scale.set( scale, scale );
			stack.container.position.set( ( width - stack.size.width * scale ) / 2, ( height - stack.size.height * scale ) / 2 );
		} );
		// Items drawn at another resolution than they are now shown at, or
		// before the angle's size was known (the first image tells).
		this.each_item_entry( function( entry, stack ) {
			var options = this.item_options( stack );
			if ( entry.item_resolution !== options.resolution || entry.item_size !== options.size ) this.update_item_entry( entry, stack, options );
		} );
	},

	on_resize: function() {
		if ( ! this.app || this.is_removed ) return;
		var container = this.$layers.get( 0 );
		var width = Math.max( 1, container.clientWidth );
		var height = Math.max( 1, container.clientHeight );
		if ( width !== this.app.renderer.width || height !== this.app.renderer.height ) {
			this.app.renderer.resize( width, height );
		}
		this.layout();
		this.stop_refresh();
		// A flat copy only lines up with the layout it was taken in.
		if ( this.cover && this.current_stack && this.cover.snapshot.layout !== this.layout_key( this.current_stack ) ) {
			this.uncover();
		}
		this.request_render();

		// Crossing a breakpoint changes which file each choice shows: resync, and
		// the layers swap images the way a selection change does.
		var bucket = this.image_bucket();
		if ( null !== this.url_bucket && bucket !== this.url_bucket ) this.schedule_sync_all();
		this.url_bucket = bucket;

		// A bigger box may need sharper textures. Waits for the resize to settle,
		// so dragging a window edge does not reload anything along the way.
		if ( this.resolution_timer ) clearTimeout( this.resolution_timer );
		var that = this;
		this.resolution_timer = setTimeout( function() {
			that.resolution_timer = null;
			if ( that.is_removed ) return;
			// Below the mobile breakpoint the budget is smaller.
			that.enforce_budget();
			that.prune_snapshots();
			// The budget may have changed: live mode may be tried again.
			that.live_blocked = false;
			that.update_mode();
			if ( that.current_stack ) that.check_resolution( that.current_stack );
			if ( that.target_stack && that.target_stack !== that.current_stack ) that.check_resolution( that.target_stack );
		}, 250 );
	},

	/*
	 * What is shown.
	 * --------------------------------------------------------------------- */

	schedule_sync: function( layer_id ) {
		this.pending_layers[ layer_id ] = true;
		this.schedule_flush();
	},

	schedule_sync_all: function() {
		PC.fe.layers.each( function( layer ) {
			this.pending_layers[ layer.id ] = true;
		}, this );
		this.schedule_flush();
	},

	/**
	 * Sync at the end of the turn. A choice change arrives as "old inactive",
	 * then "new active"; acting on the first would empty the layer before the
	 * second says what goes in its place.
	 */
	schedule_flush: function() {
		if ( this.sync_scheduled ) return;
		this.sync_scheduled = true;
		var that = this;
		Promise.resolve().then( function() { that.flush(); } );
	},

	flush: function() {
		this.sync_scheduled = false;
		if ( this.is_removed || ! this.target_stack ) return;
		this.note_activity();
		// Other angles follow once the shown one is done (update_loading()).
		this.background_dirty = true;
		var layer_ids = _.keys( this.pending_layers );
		this.pending_layers = {};
		_.each( layer_ids, function( layer_id ) {
			var record = this.target_stack.layers[ layer_id ];
			if ( record ) this.sync_layer( this.target_stack, record );
		}, this );
		this.after_change();
	},

	sync_stack: function( stack ) {
		_.each( stack.layers, function( record ) {
			this.sync_layer( stack, record );
		}, this );
	},

	/**
	 * Bring one layer of a stack in line with the models.
	 *
	 * New choices start loading and appear once loaded. Choices that leave stay
	 * on screen, under the new ones, until everything the layer is loading has
	 * settled (or PC.fe.viewer.swap_timeout passes), so a selection change never
	 * shows the background in between.
	 */
	sync_layer: function( stack, record ) {
		var state = PC.fe.viewer_state;
		var wanted = {};
		var choices = PC.fe.getLayerContent( record.layer.id );

		// The layer's mask on this angle first: its images wait for it.
		this.sync_mask( stack, record );

		var to_load = [];
		_.each( state.shown_choices( record.layer ), function( choice ) {
			var item = this.canvas_item( choice );
			if ( ! item && ! state.has_drawable( choice ) ) return;
			var key = this.view_key( choice );
			// An item draws itself: it has no file, and stays as it is.
			var url = item ? null : this.image_url( choice, stack.angle_id );
			// No image at this angle: the choice may fill the layer's mask with its colour.
			var fill = item || url ? null : PC.fe.choice_color.fill( choice, stack.angle_id );
			var fill_key = fill ? PC.fe.views.viewer_canvas.fill_key( fill ) : null;
			wanted[ key ] = true;
			if ( record.shown[ key ] ) {
				if ( record.shown[ key ].url === url && ( record.shown[ key ].fill_key || null ) === fill_key ) return;
				// Same choice, another file (a breakpoint was crossed): the old
				// image stays up until the new one has loaded.
				this.hold_or_drop( record, record.shown[ key ] );
				delete record.shown[ key ];
			}
			var entry = {
				key: key,
				model: choice,
				url: url,
				fill: fill,
				fill_key: fill_key,
				item: item,
				stack: stack,
				record: null,
				index: choices ? choices.indexOf( choice ) : 0,
				sprite: null,
				settled: false,
				removed: false,
			};
			record.shown[ key ] = entry;
			to_load.push( entry );
		}, this );

		// The masks the layer's items ask for, before they load: they wait for them.
		this.sync_item_masks( stack, record );
		_.each( to_load, function( entry ) {
			this.load_entry( stack, record, entry );
		}, this );
		// What an item asks to be cut with can change while nothing else does.
		if ( this.has_masks( record ) || ( record.node && record.node.mask ) ) this.apply_mask( stack, record );

		_.each( _.keys( record.shown ), function( key ) {
			if ( wanted[ key ] ) return;
			var entry = record.shown[ key ];
			delete record.shown[ key ];
			this.hold_or_drop( record, entry );
		}, this );

		this.release_held( record );
	},

	hold_or_drop: function( record, entry ) {
		/**
		 * Whether an image stays up until the one replacing it has loaded.
		 *
		 * @param {Boolean} hold
		 * @param {Object}  entry  The leaving item; `entry.model` is its choice.
		 * @param {Backbone.View} viewer
		 */
		var keep = wp.hooks.applyFilters( 'PC.fe.viewer.hold_previous_image', true, entry, this );
		if ( ! keep || ! entry.sprite ) return this.drop_entry( entry );
		entry.sprite.zIndex = -1;
		record.held.push( entry );
	},

	/**
	 * Let the held images go once nothing the layer shows is still loading.
	 */
	release_held: function( record ) {
		if ( ! record.held.length ) return;
		var loading = _.find( record.shown, function( entry ) {
			return ! entry.settled;
		} );
		if ( ! loading ) {
			this.drop_held( record );
			return;
		}
		if ( record.hold_timer ) return;
		var that = this;
		// However the loading turns out, these images do leave.
		record.hold_timer = setTimeout( function() {
			that.drop_held( record );
			that.request_render();
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );
	},

	drop_held: function( record ) {
		if ( record.hold_timer ) clearTimeout( record.hold_timer );
		record.hold_timer = null;
		_.each( record.held, this.drop_entry, this );
		record.held = [];
	},

	drop_entry: function( entry ) {
		entry.removed = true;
		entry.settled = true;
		if ( entry.mask_sprite ) {
			PC.fe.views.viewer_canvas.destroy_sprite( entry.mask_sprite );
			entry.mask_sprite = null;
		}
		if ( entry.sprite ) {
			// An item's container goes with what it holds; its textures are the
			// item's (text, a canvas), not the viewer's.
			if ( entry.item ) PC.fe.views.viewer_canvas.destroy_item_container( entry.item, entry.sprite );
			else entry.sprite.destroy();
			entry.sprite = null;
		}
		if ( entry.record ) {
			entry.record.entries = _.without( entry.record.entries, entry );
			entry.record = null;
		}
		// One image fewer: a layer back to one image goes back to the node mask.
		var layer_record = entry.stack && entry.stack.layers && entry.model ? entry.stack.layers[ entry.model.get( 'layerId' ) ] : null;
		if ( layer_record && this.has_masks( layer_record ) ) this.apply_mask( entry.stack, layer_record );
	},

	/*
	 * Layer masks (docs/layer-masks-spec.md).
	 * --------------------------------------------------------------------- */

	/**
	 * Bring a layer's mask in line with the angle: load the layer's mask for
	 * it, or drop the one it has. Loaded as a texture of the viewer under its
	 * own key (mask_key()), redrawn as Pixi reads masks (whiten()), inside the budget like any texture.
	 *
	 * Until it is in (or has failed), the layer counts as loading
	 * (mask_pending()), and its images wait for it (load_entry()), so the
	 * picture never shows the layer uncut. A mask that cannot load leaves the
	 * layer unmasked (decision 6).
	 */
	sync_mask: function( stack, record ) {
		var image = PC.fe.layer_masks ? PC.fe.layer_masks.get( record.layer, stack.angle_id ) : null;
		var url = image ? image.url : '';
		var mask = record.mask;
		if ( mask && mask.url === url && ! mask.abandoned && ! ( mask.texture_record && mask.texture_record.destroyed ) ) return;
		this.drop_mask( record );
		if ( ! url ) {
			this.apply_mask( stack, record );
			return;
		}
		record.mask = this.load_mask( stack, record, url, function( loaded ) {
			return record.mask === loaded;
		} );
	},

	/**
	 * The masks a layer's add-on items ask for, other than the layer's own
	 * (item_mask_url()): loaded and pinned like the layer's, dropped once no
	 * item of the layer, shown or held, asks for them.
	 */
	sync_item_masks: function( stack, record ) {
		record.item_masks = record.item_masks || {};
		var layer_url = record.mask ? record.mask.url : '';
		var wanted = {};
		_.each( _.values( record.shown ).concat( record.held ), function( entry ) {
			if ( ! entry.item ) return;
			var url = this.entry_mask_url( stack, record, entry );
			if ( url && url !== layer_url ) wanted[ url ] = true;
		}, this );
		_.each( _.keys( record.item_masks ), function( url ) {
			if ( ! wanted[ url ] ) this.drop_item_mask( record, url );
		}, this );
		_.each( _.keys( wanted ), function( url ) {
			var mask = record.item_masks[ url ];
			if ( mask && ! mask.abandoned && ! ( mask.texture_record && mask.texture_record.destroyed ) ) return;
			if ( mask ) this.drop_item_mask( record, url );
			record.item_masks[ url ] = this.load_mask( stack, record, url, function( loaded ) {
				return record.item_masks[ url ] === loaded;
			} );
		}, this );
	},

	/**
	 * The mask an entry is cut with: the layer's for an image, the one the
	 * item asks for (statics.item_mask_url()) for an add-on item. '' for none.
	 */
	entry_mask_url: function( stack, record, entry ) {
		if ( ! entry.item ) return record.mask ? record.mask.url : '';
		return PC.fe.views.viewer_canvas.item_mask_url( entry.item, record.layer, stack.angle_id );
	},

	/**
	 * Load a mask for a layer of a stack: a texture of the viewer under its
	 * mask key, redrawn as Pixi reads masks (whiten()), inside the budget, pinned
	 * by the layer while in use (mask_users). Applied once in; one that cannot
	 * load leaves what it cuts uncut (layer masks decision 6).
	 *
	 * @param {Object}   stack
	 * @param {Object}   record  The layer's record.
	 * @param {String}   url
	 * @param {Function} current Whether the returned mask is still the one in use.
	 * @return {Object} The mask: { url, key, texture_record, done, failed, abandoned, promise }
	 */
	load_mask: function( stack, record, url, current ) {
		var that = this;
		var statics = PC.fe.views.viewer_canvas;
		var key = statics.mask_key( url );
		var mask = { url: url, key: key, texture_record: null, done: false, failed: false, abandoned: false, promise: null };
		var shown_or_coming = function() {
			return stack === that.current_stack || stack === that.target_stack;
		};
		var wanted = function() {
			return current( mask ) && ( shown_or_coming() || ( 'live' === that.mode && that.stacks[ stack.angle_id ] === stack ) );
		};
		// Pinned while it loads, like an image waiting for its sprite.
		var waiter = { stack: stack, mask: true };
		( this.waiting[ key ] = this.waiting[ key ] || [] ).push( waiter );
		var settle = function( texture_record ) {
			that.waiting[ key ] = _.without( that.waiting[ key ] || [], waiter );
			if ( ! that.waiting[ key ].length ) delete that.waiting[ key ];
			if ( that.is_removed || ! current( mask ) ) return;
			if ( statics.abandoned === texture_record ) {
				// Its angle was left: loaded again when shown (the layer stays pending).
				mask.abandoned = true;
				return;
			}
			if ( texture_record && texture_record.texture && ! texture_record.destroyed ) {
				mask.texture_record = texture_record;
				( texture_record.mask_users = texture_record.mask_users || [] ).push( { stack: stack, record: record, mask: mask } );
				that.touch( texture_record );
			} else {
				mask.failed = true;
				console.log( 'Product configurator: the mask ' + url + ' could not be loaded, what it cuts is drawn unmasked.' );
			}
			mask.done = true;
			that.apply_mask( stack, record );
			that.after_change();
			that.enforce_budget();
		};
		mask.promise = this.load_texture( key, stack, wanted, function() {
			return ! shown_or_coming();
		} ).then( settle, function( error ) {
			console.log( 'Product configurator: could not prepare the mask ' + url, error );
			settle( null );
		} );
		return mask;
	},

	/**
	 * Whether a layer has a mask, its own or one of its items'.
	 */
	has_masks: function( record ) {
		return !! record.mask || ( !! record.item_masks && Object.keys( record.item_masks ).length > 0 );
	},

	/**
	 * Whether a layer is still waiting for its mask.
	 */
	mask_pending: function( record ) {
		if ( record.mask && ! record.mask.done ) return true;
		var masks = record.item_masks || {};
		return Object.keys( masks ).some( function( url ) {
			return masks[ url ] && ! masks[ url ].done;
		} );
	},

	/**
	 * Resolves once the layer's mask is in, has failed or was given up.
	 *
	 * @return {Promise}
	 */
	mask_ready: function( record ) {
		var masks = record.item_masks || {};
		var promises = [];
		if ( record.mask && record.mask.promise ) promises.push( record.mask.promise );
		Object.keys( masks ).forEach( function( url ) {
			if ( masks[ url ] && masks[ url ].promise ) promises.push( masks[ url ].promise );
		} );
		return promises.length ? Promise.all( promises ) : Promise.resolve();
	},

	/**
	 * Forget a layer's mask: its sprites go, and its texture is no longer
	 * pinned by this layer.
	 */
	drop_mask: function( record ) {
		var mask = record.mask;
		record.mask = null;
		this.unpin_mask( mask );
		this.clear_mask_sprites( record );
	},

	/**
	 * Forget a mask an item of the layer asked for.
	 */
	drop_item_mask: function( record, url ) {
		var mask = record.item_masks[ url ];
		delete record.item_masks[ url ];
		this.unpin_mask( mask );
		this.clear_mask_sprites( record );
	},

	/**
	 * Every mask of a layer, its own and its items'.
	 */
	drop_masks: function( record ) {
		var that = this;
		Object.keys( record.item_masks || {} ).forEach( function( url ) {
			that.drop_item_mask( record, url );
		} );
		this.drop_mask( record );
	},

	unpin_mask: function( mask ) {
		if ( ! mask || ! mask.texture_record || ! mask.texture_record.mask_users ) return;
		mask.texture_record.mask_users = _.reject( mask.texture_record.mask_users, function( user ) {
			return user.mask === mask;
		} );
	},

	/**
	 * Whether a mask is one of the layer's, its own or an item's.
	 */
	holds_mask: function( record, mask ) {
		return !! mask && ( record.mask === mask || ( record.item_masks || {} )[ mask.url ] === mask );
	},

	clear_mask_sprites: function( record ) {
		var destroy = PC.fe.views.viewer_canvas.destroy_sprite;
		if ( record.node ) record.node.mask = null;
		if ( record.mask_sprite ) {
			destroy( record.mask_sprite );
			record.mask_sprite = null;
		}
		var clear = function( entry ) {
			if ( ! entry.mask_sprite ) return;
			if ( entry.sprite ) entry.sprite.mask = null;
			destroy( entry.mask_sprite );
			entry.mask_sprite = null;
		};
		_.each( record.shown, clear );
		_.each( record.held, clear );
	},

	/**
	 * Cut a layer's images with its mask (decision 7: each image on its own),
	 * and its add-on items with the mask each asks for (item_mask_url()).
	 *
	 * A layer drawing one image cut by the layer's mask masks its node, the
	 * cheap way. Anything else masks each sprite: several images (a multiple
	 * choice layer, or an image held during a swap), so overlapping images are
	 * cut the way the <img> stack and the server merge cut them; or an item
	 * asking for another mask than the layer's, or none, which the node mask
	 * would cut anyway. The mask sprites live in the node, placed like an image
	 * of the mask's size; Pixi does not draw a sprite used as a mask.
	 */
	apply_mask: function( stack, record ) {
		if ( ! record || this.is_removed ) return;
		var usable = function( mask ) {
			return mask && mask.texture_record && mask.texture_record.texture && ! mask.texture_record.destroyed ? mask.texture_record : null;
		};
		var layer_url = record.mask ? record.mask.url : '';
		var plan = _.map( _.filter( _.values( record.shown ).concat( record.held ), function( entry ) {
			return !! entry.sprite;
		} ), function( entry ) {
			// An image: the layer's mask.
			if ( ! entry.item ) return { entry: entry, texture_record: usable( record.mask ), layer: true };
			var url = this.entry_mask_url( stack, record, entry );
			var mask = ! url ? null : ( url === layer_url ? record.mask : ( record.item_masks || {} )[ url ] );
			return { entry: entry, texture_record: usable( mask ), layer: !! url && url === layer_url };
		}, this );
		var layer_texture = usable( record.mask );
		if ( ! layer_texture && ! _.find( plan, function( step ) {
			return step.texture_record;
		} ) ) {
			this.clear_mask_sprites( record );
			this.request_render();
			return;
		}

		var statics = PC.fe.views.viewer_canvas;
		var that = this;
		var ensure = function( sprite, texture_record ) {
			if ( sprite && sprite.texture === texture_record.texture && ! sprite.destroyed ) {
				that.place_mask_sprite( sprite, stack, texture_record );
				return sprite;
			}
			if ( sprite ) statics.destroy_sprite( sprite );
			sprite = new PIXI.Sprite( texture_record.texture );
			that.place_mask_sprite( sprite, stack, texture_record );
			record.node.addChild( sprite );
			return sprite;
		};
		var unmask = function( entry ) {
			if ( ! entry.mask_sprite ) return;
			entry.sprite.mask = null;
			statics.destroy_sprite( entry.mask_sprite );
			entry.mask_sprite = null;
		};

		if ( layer_texture && plan.length <= 1 && ( ! plan.length || plan[ 0 ].layer ) ) {
			_.each( plan, function( step ) {
				unmask( step.entry );
			} );
			record.mask_sprite = ensure( record.mask_sprite, layer_texture );
			record.node.mask = record.mask_sprite;
		} else {
			record.node.mask = null;
			if ( record.mask_sprite ) {
				statics.destroy_sprite( record.mask_sprite );
				record.mask_sprite = null;
			}
			_.each( plan, function( step ) {
				if ( ! step.texture_record ) {
					unmask( step.entry );
					return;
				}
				step.entry.mask_sprite = ensure( step.entry.mask_sprite, step.texture_record );
				step.entry.sprite.mask = step.entry.mask_sprite;
			} );
		}
		this.request_render();
	},

	/**
	 * A mask sprite at its natural size, centred in the angle like an image.
	 */
	place_mask_sprite: function( sprite, stack, texture_record ) {
		var natural = texture_record.natural;
		var size = stack.size || natural;
		this.fit_sprite( sprite, texture_record );
		sprite.position.set( ( size.width - natural.width ) / 2, ( size.height - natural.height ) / 2 );
	},

	load_entry: function( stack, record, entry ) {
		if ( entry.item ) return this.load_item_entry( stack, record, entry );
		if ( entry.fill ) return this.load_fill_entry( stack, record, entry );
		if ( ! entry.url ) {
			// Nothing to draw at this angle, and that is fine.
			entry.settled = true;
			return;
		}
		var that = this;
		var url = entry.url;
		// From the moment a texture resolves until its sprite exists, nothing
		// else marks it as used, and another load's enforce_budget() would
		// release it. The waiting entry pins it for that window.
		( this.waiting[ url ] = this.waiting[ url ] || [] ).push( entry );
		var shown_or_coming = function() {
			return entry.stack === that.current_stack || entry.stack === that.target_stack;
		};
		var wanted = function() {
			if ( entry.removed ) return false;
			// Another visited angle only while they are kept live (update_mode()).
			return shown_or_coming() || ( 'live' === that.mode && that.stacks[ entry.stack.angle_id ] === entry.stack );
		};
		var background = function() {
			return ! shown_or_coming();
		};
		this.load_texture( url, stack, wanted, background ).then( function( texture_record ) {
			// A masked layer's image is not drawn before its mask is in: the
			// waiting entry keeps the texture pinned meanwhile.
			return that.mask_ready( record ).then( function() {
				return texture_record;
			} );
		} ).then( function( texture_record ) {
			that.waiting[ url ] = _.without( that.waiting[ url ] || [], entry );
			if ( ! that.waiting[ url ].length ) delete that.waiting[ url ];
			if ( entry.removed || that.is_removed ) return;
			if ( PC.fe.views.viewer_canvas.abandoned === texture_record ) {
				// Its angle was left before the image's turn to decode came. The
				// entry goes, so showing that angle again creates and loads it anew.
				if ( record.shown[ entry.key ] === entry ) delete record.shown[ entry.key ];
				entry.removed = true;
				entry.settled = true;
				that.release_held( record );
				that.after_change();
				return;
			}
			if ( texture_record && ( texture_record.destroyed || ! texture_record.texture ) ) {
				// Released anyway (a remount, a context loss): load it again, once.
				entry.retries = ( entry.retries || 0 ) + 1;
				if ( entry.retries <= 1 ) {
					that.load_entry( stack, record, entry );
					return;
				}
				texture_record = null;
			}
			if ( texture_record ) {
				var natural = texture_record.natural;
				if ( ! stack.size ) {
					stack.size = { width: natural.width, height: natural.height };
					that.add_probe( stack );
				}
				var sprite = new PIXI.Sprite( texture_record.texture );
				that.fit_sprite( sprite, texture_record );
				sprite.position.set( ( stack.size.width - natural.width ) / 2, ( stack.size.height - natural.height ) / 2 );
				sprite.zIndex = entry.index;
				record.node.addChild( sprite );
				entry.sprite = sprite;
				entry.record = texture_record;
				texture_record.entries.push( entry );
				that.apply_mask( stack, record );
				that.touch( texture_record );
				wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', entry, that );
			}
			entry.settled = true;
			that.release_held( record );
			that.after_change();
			that.enforce_budget();
		} ).catch( function( error ) {
			// A bug must not leave the angle loading for ever: count it as a
			// failed image, like one that could not be downloaded.
			console.log( 'Product configurator: could not draw the image ' + url, error );
			that.waiting[ url ] = _.without( that.waiting[ url ] || [], entry );
			if ( ! that.waiting[ url ].length ) delete that.waiting[ url ];
			if ( entry.removed || that.is_removed ) return;
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		} );
	},

	/**
	 * A colour's entry (docs/solid-colour-choices-spec.md): a sprite of Pixi's shared white
	 * texture, tinted, at the mask's natural size, placed like an image of that size. No
	 * texture is loaded or counted in the budget; it waits for the layer's mask like an image,
	 * so it never shows uncut.
	 */
	load_fill_entry: function( stack, record, entry ) {
		var that = this;
		var done = function() {
			if ( entry.removed || that.is_removed || ! that.app ) return;
			var fill = entry.fill;
			if ( ! stack.size ) {
				stack.size = { width: fill.width, height: fill.height };
				that.add_probe( stack );
			}
			var sprite = PC.fe.views.viewer_canvas.fill_sprite( fill );
			sprite.position.set( ( stack.size.width - fill.width ) / 2, ( stack.size.height - fill.height ) / 2 );
			sprite.zIndex = entry.index;
			record.node.addChild( sprite );
			entry.sprite = sprite;
			that.apply_mask( stack, record );
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		};
		if ( this.mask_pending( record ) ) {
			// A mask that fails still draws the colour, uncut (layer masks decision 6).
			this.mask_ready( record ).then( done, done );
		} else {
			done();
		}
	},

	/**
	 * An add-on item's entry: once the item is ready (its fonts loaded, say),
	 * it creates its container for the angle, placed in the choice's layer
	 * node like an image. Counts as loading until then.
	 */
	load_item_entry: function( stack, record, entry ) {
		var that = this;
		var item = entry.item;
		var ready;
		try {
			ready = item.ready ? item.ready( stack.angle_id ) : null;
		} catch ( error ) {
			ready = null;
		}
		var done = function() {
			if ( entry.removed || that.is_removed || ! that.app ) return;
			var options = that.item_options( stack );
			var container = null;
			try {
				container = item.create( stack.angle_id, options ) || null;
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not be drawn.', error );
			}
			if ( container ) {
				container.zIndex = entry.index;
				record.node.addChild( container );
				entry.sprite = container;
				entry.item_resolution = options.resolution;
				entry.item_size = options.size;
				if ( that.has_masks( record ) ) that.apply_mask( stack, record );
			}
			entry.settled = true;
			that.release_held( record );
			that.after_change();
		};
		// Never drawn uncut: the layer's masks first, its own and its items'.
		var masked = function() {
			if ( that.mask_pending( record ) ) {
				that.mask_ready( record ).then( done, done );
			} else {
				done();
			}
		};
		if ( ready && 'function' === typeof ready.then ) {
			// A failed ready() still draws: a fallback font beats an endless loader.
			ready.then( masked, masked );
		} else {
			masked();
		}
	},

	/**
	 * Draw a possibly downscaled texture at its image's natural size, in the
	 * stack's coordinates (the angle's image size).
	 */
	fit_sprite: function( sprite, texture_record ) {
		sprite.scale.set(
			texture_record.natural.width / texture_record.texture.width,
			texture_record.natural.height / texture_record.texture.height
		);
	},

	/*
	 * Textures.
	 * --------------------------------------------------------------------- */

	/**
	 * Load an image once, decoded, at its full size.
	 *
	 * The viewer loads and owns its images rather than going through
	 * PIXI.Assets: that cache is shared by the whole page, and unloading it on
	 * teardown would race with a viewer mounting again as the modal reopens.
	 * The browser's HTTP cache still makes a second load cheap.
	 *
	 * Resolves null when the image cannot be used. A cross-origin image that
	 * fails is assumed to lack CORS headers: WebGL cannot read it at all, while
	 * the <img> stack can still show it, so the viewer falls back.
	 *
	 * @param {String}  url
	 * @param {Boolean} defer_decode Resolve once downloaded, without decoding:
	 *                               the caller decodes in a slot (decode_slot()).
	 * @return {Promise<HTMLImageElement|null>}
	 */
	load_image: function( url, defer_decode ) {
		var that = this;
		var cross_origin = this.is_cross_origin( url );
		return new Promise( function( resolve ) {
			var image = new Image();
			// Only for other domains: a same-origin request keeps the mode the
			// <img> stack used, so it is served from the same cache entry.
			if ( cross_origin ) image.crossOrigin = 'anonymous';
			image.onload = function() {
				if ( defer_decode ) {
					resolve( that.is_removed || ! image.naturalWidth ? null : image );
					return;
				}
				that.decode_image( image ).then( function() {
					resolve( that.is_removed || ! image.naturalWidth ? null : image );
				} );
			};
			image.onerror = function( error ) {
				if ( cross_origin ) {
					that.fall_back( 'cors', url );
				} else {
					console.log( 'Product configurator: could not load the image ' + url, error );
				}
				resolve( null );
			};
			image.src = url;
		} );
	},

	/**
	 * decode() moves decoding off the main thread, but it stays pending while
	 * the page is not rendered (a background tab). It is only an optimisation:
	 * past a second the image is used anyway, so a capture asked for in the
	 * background still resolves.
	 *
	 * @return {Promise}
	 */
	decode_image: function( image ) {
		if ( ! image.decode ) return Promise.resolve();
		return Promise.race( [
			image.decode().catch( function() {} ),
			new Promise( function( done ) { setTimeout( done, 1000 ); } ),
		] );
	},

	/**
	 * How many images may be decoded at full size at once.
	 *
	 * Each one costs width × height × 4 until its texture is built (32 MiB for
	 * 3840×2160), whatever the texture's final size. Started all together, the
	 * first picture of a product with many layers briefly needs all of them at
	 * once, which is what made iOS Safari kill the tab (see the performance
	 * section of docs/canvas-viewer-spec.md). Downloads are not limited.
	 *
	 * @return {Number}
	 */
	decode_limit: function() {
		var limit = PC.fe.views.viewer_canvas.small_screen() ? 3 : 6;
		/**
		 * Filter how many images the canvas viewer decodes at full size at once.
		 *
		 * @param {Number} limit
		 * @param {Backbone.View} viewer
		 */
		limit = parseInt( wp.hooks.applyFilters( 'PC.fe.viewer.canvas.decode_limit', limit, this ), 10 );
		return limit > 0 ? limit : 1;
	},

	/**
	 * Wait for a decode slot, first come first served.
	 *
	 * A waiter whose `wanted` says no when its turn comes is skipped: fast
	 * angle switching only decodes for the angles still shown or coming.
	 *
	 * @param {Function} wanted Optional.
	 * @return {Promise<Function|null>} The function that frees the slot, or
	 *                                  null when the slot was given up.
	 */
	decode_slot: function( wanted, background ) {
		var that = this;
		return new Promise( function( resolve ) {
			var waiter = {
				wanted: function() {
					return that.is_removed || ! wanted || !! wanted();
				},
				background: function() {
					return !! ( background && background() );
				},
				give_up: function() {
					resolve( null );
				},
				grant: function() {
					that.decoding++;
					var freed = false;
					resolve( function() {
						if ( freed ) return;
						freed = true;
						that.decoding--;
						that.next_decode();
					} );
				},
			};
			if ( that.decoding < that.decode_limit() ) waiter.grant();
			else that.decode_queue.push( waiter );
		} );
	},

	/**
	 * Hand a freed slot on: waiters nobody wants any more give up, then the
	 * first one for the picture shown or coming goes, else the first
	 * background one (eager mode, other angles, snapshot refreshes).
	 */
	next_decode: function() {
		this.decode_queue = this.decode_queue.filter( function( waiter ) {
			if ( waiter.wanted() ) return true;
			waiter.give_up();
			return false;
		} );
		if ( ! this.decode_queue.length || this.decoding >= this.decode_limit() ) return;
		var index = this.decode_queue.findIndex( function( waiter ) {
			return ! waiter.background();
		} );
		this.decode_queue.splice( index < 0 ? 0 : index, 1 )[ 0 ].grant();
	},

	/**
	 * Let the browser drop a full-size image once a smaller copy exists. A
	 * texture drawn from the image itself (full size) keeps it.
	 */
	release_image: function( image, built ) {
		if ( ! image ) return;
		var source = built && built.texture && built.texture.source;
		if ( source && source.resource === image ) return;
		image.onload = null;
		image.onerror = null;
		image.removeAttribute( 'src' );
	},

	/**
	 * Download an image and build its texture, decoding in a slot.
	 *
	 * @param {String}   url
	 * @param {Function} scale_for Given the natural { width, height }, the scale
	 *                             to build at; asked once the slot is granted, so
	 *                             a resize while waiting is taken into account.
	 * @param {Function} wanted     Asked when the slot comes; false gives it up.
	 * @param {Function} background True while only background work wants it.
	 * @return {Promise<Object|null>} { built, natural, scale }, null, or
	 *                                PC.fe.views.viewer_canvas.abandoned.
	 */
	fetch_texture: function( url, scale_for, wanted, background ) {
		if ( 'blob' === this.image_decoder() ) return this.fetch_bitmap( url, scale_for, wanted, background );
		return this.fetch_element( url, scale_for, wanted, background );
	},

	/**
	 * How images are decoded: through an <img> element ('element', the
	 * default for now), or fetched and decoded straight into a downscaled
	 * bitmap ('blob'). Read for each load, so a switch applies to the next
	 * one (reload_textures() reloads everything).
	 *
	 * @return {String} element | blob
	 */
	image_decoder: function() {
		/**
		 * Filter how the canvas viewer decodes its images.
		 *
		 * 'element' loads each image in an <img>, decodes it at full size and
		 * downscales a copy; Safari keeps those full-size decodes in its image
		 * cache for a while. 'blob' fetches the file and decodes it with
		 * createImageBitmap( blob ), resized as it decodes, so no <img> holds
		 * it. Falls back to 'element' where fetch or createImageBitmap is
		 * missing, and for an image createImageBitmap cannot decode.
		 *
		 * @param {String} decoder element | blob
		 * @param {Backbone.View} viewer
		 */
		var decoder = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.image_decoder', 'element', this );
		if ( 'blob' !== decoder ) return 'element';
		if ( 'function' !== typeof window.fetch || 'function' !== typeof window.createImageBitmap || ! window.URL || 'function' !== typeof URL.createObjectURL ) return 'element';
		return 'blob';
	},

	/**
	 * fetch_texture() through an <img>: downloaded, then decoded at full size
	 * in a decode slot and downscaled (build_texture()).
	 */
	fetch_element: function( url, scale_for, wanted, background ) {
		var that = this;
		return this.load_image( url, true ).then( function( image ) {
			if ( ! image ) return null;
			return that.decode_slot( wanted, background ).then( function( free ) {
				if ( ! free ) {
					that.release_image( image );
					return PC.fe.views.viewer_canvas.abandoned;
				}
				var finish = function( result ) {
					free();
					that.release_image( image, result && result.built );
					return result;
				};
				if ( that.is_removed ) return finish( null );
				var natural = { width: image.naturalWidth, height: image.naturalHeight };
				var scale = scale_for( natural );
				return that.decode_image( image ).then( function() {
					return that.is_removed ? null : that.build_texture( image, natural, scale, PC.fe.views.viewer_canvas.is_mask_key( url ) );
				} ).then( function( built ) {
					return finish( built ? { built: built, natural: natural, scale: scale } : null );
				}, function( error ) {
					console.log( 'Product configurator: could not prepare the image ' + url, error );
					return finish( null );
				} );
			} );
		} );
	},

	/**
	 * fetch_texture() without an <img>: the file is fetched, its size read
	 * from a header-only load, then decoded in a decode slot straight to the
	 * texture's size (build_bitmap()). An image createImageBitmap() cannot
	 * decode (an SVG in some browsers) goes through fetch_element() instead.
	 */
	fetch_bitmap: function( url, scale_for, wanted, background ) {
		var that = this;
		return this.load_blob( url ).then( function( loaded ) {
			if ( ! loaded ) return null;
			return that.decode_slot( wanted, background ).then( function( free ) {
				if ( ! free ) return PC.fe.views.viewer_canvas.abandoned;
				if ( that.is_removed ) {
					free();
					return null;
				}
				var natural = loaded.natural;
				var scale = scale_for( natural );
				return that.build_bitmap( loaded.blob, natural, scale, PC.fe.views.viewer_canvas.is_mask_key( url ) ).then( function( built ) {
					free();
					if ( built && that.is_removed ) {
						that.destroy_built( built );
						return null;
					}
					return built ? { built: built, natural: natural, scale: scale } : null;
				}, function( error ) {
					free();
					if ( that.is_removed ) return null;
					console.log( 'Product configurator: could not decode the image ' + url + ' from its file, loading it as an image', error );
					return that.fetch_element( url, scale_for, wanted, background );
				} );
			} );
		} );
	},

	/**
	 * Download an image file and read its size.
	 *
	 * The request matches the one an <img> would make (no credentials for
	 * other domains), so it shares the HTTP cache. A cross-origin failure is
	 * taken for missing CORS headers, as in load_image().
	 *
	 * @param {String} url
	 * @return {Promise<Object|null>} { blob, natural }
	 */
	load_blob: function( url ) {
		var that = this;
		var cross_origin = this.is_cross_origin( url );
		return window.fetch( url, {
			mode: cross_origin ? 'cors' : 'same-origin',
			credentials: cross_origin ? 'omit' : 'same-origin',
		} ).then( function( response ) {
			if ( ! response.ok ) throw new Error( 'HTTP ' + response.status );
			return response.blob();
		} ).then( function( blob ) {
			if ( that.is_removed ) return null;
			return that.blob_size( blob ).then( function( natural ) {
				if ( ! natural ) throw new Error( 'not an image' );
				return { blob: blob, natural: natural };
			} );
		} ).catch( function( error ) {
			if ( that.is_removed ) return null;
			if ( cross_origin ) {
				that.fall_back( 'cors', url );
			} else {
				console.log( 'Product configurator: could not load the image ' + url, error );
			}
			return null;
		} );
	},

	/**
	 * An image file's natural size, from an <img> that only loads it: the
	 * size comes from the file's header, and an image never drawn nor
	 * decode()d is not decoded. The element and its object URL go at once.
	 *
	 * @param {Blob} blob
	 * @return {Promise<Object|null>} { width, height }
	 */
	blob_size: function( blob ) {
		return new Promise( function( resolve ) {
			var link = URL.createObjectURL( blob );
			var image = new Image();
			var done = function( size ) {
				image.onload = null;
				image.onerror = null;
				image.removeAttribute( 'src' );
				URL.revokeObjectURL( link );
				resolve( size );
			};
			image.onload = function() {
				done( image.naturalWidth ? { width: image.naturalWidth, height: image.naturalHeight } : null );
			};
			image.onerror = function() {
				done( null );
			};
			image.src = link;
		} );
	},

	/**
	 * A texture decoded from an image file at a scale, resized as it decodes.
	 * A browser that ignores the resize options hands back the full image,
	 * which is then drawn smaller on a 2D canvas and closed.
	 *
	 * @param {Blob}   blob
	 * @param {Object} natural { width, height }
	 * @param {Number} scale
	 * @return {Promise<Object|null>} { texture, bitmap }; rejects when the
	 *                                browser cannot decode the file.
	 */
	build_bitmap: function( blob, natural, scale, whiten ) {
		var that = this;
		var width = Math.max( 1, Math.round( natural.width * scale ) );
		var height = Math.max( 1, Math.round( natural.height * scale ) );
		var options = { premultiplyAlpha: 'premultiply' };
		if ( width < natural.width || height < natural.height ) {
			options.resizeWidth = width;
			options.resizeHeight = height;
			options.resizeQuality = 'high';
		}
		return window.createImageBitmap( blob, options ).then( function( bitmap ) {
			if ( bitmap.width === width && bitmap.height === height ) return that.make_built( bitmap, bitmap, whiten );
			var canvas = that.downscale( bitmap, width, height );
			bitmap.close();
			return canvas ? that.make_built( canvas, null, whiten ) : null;
		} );
	},

	/**
	 * A texture of a resource. A mask's (whiten) is redrawn opaque grey, grey
	 * = its alpha: Pixi's sprite mask reads the mask's red channel times its
	 * alpha (see whiten(); docs/layer-masks-spec.md).
	 */
	make_built: function( resource, bitmap, whiten ) {
		if ( whiten ) {
			var white = PC.fe.views.viewer_canvas.whiten( resource );
			if ( bitmap && bitmap.close ) bitmap.close();
			if ( ! white ) return null;
			resource = white;
			bitmap = null;
		}
		return {
			texture: new PIXI.Texture( { source: new PIXI.ImageSource( { resource: resource } ) } ),
			bitmap: bitmap || null,
		};
	},

	/**
	 * The texture for a URL, sharp enough for the stack it is drawn in.
	 *
	 * One texture per URL, downscaled to what the box shows (see
	 * texture_scale()). When a bigger box needs more pixels, the same record is
	 * upgraded and every sprite using it switches over.
	 *
	 * A load that is still waiting for its decode slot when nobody wants it
	 * any more (every caller's `wanted` says no) gives the slot up and
	 * resolves with PC.fe.views.viewer_canvas.abandoned.
	 *
	 * @param {String}   url
	 * @param {Object}   stack
	 * @param {Function} wanted     Whether this caller still needs the texture;
	 *                              omitted, it always does.
	 * @param {Function} background True while this caller is background work;
	 *                              omitted, it is not.
	 * @return {Promise<Object|null>} The texture record, null, or `abandoned`.
	 */
	load_texture: function( url, stack, wanted, background ) {
		var record = this.textures[ url ];
		var that = this;
		var abandoned = PC.fe.views.viewer_canvas.abandoned;
		wanted = wanted || function() {
			return true;
		};
		background = background || function() {
			return false;
		};
		var claim = { wanted: wanted, background: background };
		if ( record ) {
			if ( record.claims ) record.claims.push( claim );
			return record.promise.then( function( loaded ) {
				if ( that.is_removed ) return null;
				if ( abandoned === loaded ) {
					// Given up for the other callers: this one loads it, if still needed.
					return wanted() ? that.load_texture( url, stack, wanted, background ) : abandoned;
				}
				if ( ! loaded ) return null;
				// Released while this caller waited: load it again.
				if ( record.destroyed ) return that.load_texture( url, stack, wanted, background );
				var needed = that.texture_scale( stack, record.natural );
				if ( needed <= record.scale ) return record;
				return that.upgrade_texture( record, needed );
			} );
		}

		record = {
			url: url,
			texture: null,
			natural: null,
			scale: 0,
			bytes: 0,
			last_used: 0,
			entries: [],
			destroyed: false,
			promise: null,
			upgrading: null,
			// Every caller's `wanted`, until the decode slot is granted.
			claims: [ claim ],
		};
		this.textures[ url ] = record;
		record.promise = this.fetch_texture( url, function( natural ) {
			return that.texture_scale( stack, natural );
		}, function() {
			return !! _.find( record.claims, function( item ) {
				return item.wanted();
			} );
		}, function() {
			// Background only while no caller that still wants it is in the foreground.
			return ! _.find( record.claims, function( item ) {
				return item.wanted() && ! item.background();
			} );
		} ).then( function( result ) {
			record.claims = null;
			if ( abandoned === result ) {
				if ( that.textures[ url ] === record ) delete that.textures[ url ];
				return abandoned;
			}
			if ( ! result || that.is_removed || record.destroyed ) {
				if ( result ) that.destroy_built( result.built );
				if ( that.textures[ url ] === record ) delete that.textures[ url ];
				return null;
			}
			record.natural = result.natural;
			that.set_texture( record, result.built, result.scale );
			that.touch( record );
			return record;
		} );
		return record.promise;
	},

	/**
	 * Replace a record's texture with a sharper one, keeping its sprites.
	 */
	upgrade_texture: function( record, scale ) {
		var that = this;
		if ( record.upgrading && record.upgrading.scale >= scale ) return record.upgrading.promise;
		var promise = this.fetch_texture( record.url, function() {
			return scale;
		} ).then( function( result ) {
			var built = result && result.built;
			if ( ! built || that.is_removed || record.destroyed ) {
				that.destroy_built( built );
				return record.destroyed ? null : record;
			}
			if ( scale <= record.scale ) {
				that.destroy_built( built );
				return record;
			}
			var old = { texture: record.texture, bitmap: record.bitmap };
			that.set_texture( record, built, scale );
			_.each( record.entries, function( entry ) {
				if ( ! entry.sprite ) return;
				entry.sprite.texture = record.texture;
				that.fit_sprite( entry.sprite, record );
			} );
			// A layer mask: its mask sprites move to the new texture.
			_.each( record.mask_users || [], function( user ) {
				that.apply_mask( user.stack, user.record );
			} );
			that.destroy_built( old );
			that.request_render();
			that.enforce_budget();
			return record;
		} );
		record.upgrading = { scale: scale, promise: promise };
		promise.then( function() {
			if ( record.upgrading && record.upgrading.promise === promise ) record.upgrading = null;
		} );
		return promise;
	},

	set_texture: function( record, built, scale ) {
		record.texture = built.texture;
		record.bitmap = built.bitmap;
		record.scale = scale;
		record.bytes = built.texture.width * built.texture.height * 4;
		record.freed = this.free_source( built );
	},

	/**
	 * Upload a texture now and free the image it was built from.
	 *
	 * Until then every texture is held twice: on the GPU, and as the bitmap,
	 * canvas or image Pixi uploads from, which is just as big. That copy only
	 * serves a second upload, and the viewer never needs one: Pixi's collector
	 * is off (start()), an upgrade builds a new texture, and a restored
	 * context loads every image again (reload_textures()).
	 *
	 * @param {Object} built { texture, bitmap }
	 * @return {Boolean} Whether the image was freed.
	 */
	free_source: function( built ) {
		var source = built && built.texture && built.texture.source;
		var resource = source && source.resource;
		var renderer = this.app && this.app.renderer;
		if ( ! resource || ! renderer || ! renderer.texture || 'function' !== typeof renderer.texture.initSource ) return false;
		var gl = renderer.gl;
		// Nothing to upload to: keep it, the restored context reloads anyway.
		if ( gl && gl.isContextLost && gl.isContextLost() ) return false;
		try {
			renderer.texture.initSource( source );
		} catch ( error ) {
			return false;
		}
		if ( 'function' === typeof resource.close ) {
			resource.close();
		} else if ( 'CANVAS' === resource.nodeName ) {
			resource.width = 0;
			resource.height = 0;
		} else if ( 'IMG' === resource.nodeName ) {
			resource.onload = null;
			resource.onerror = null;
			resource.removeAttribute( 'src' );
		}
		return true;
	},

	/**
	 * After a restored context: the GPU kept nothing and the images were
	 * freed, so every texture goes and the angles on screen load again. The
	 * others load when shown, or in the background (start_background()).
	 */
	reload_textures: function() {
		this.stop_background();
		this.stop_refresh();
		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				this.drop_held( record );
				_.each( record.shown, this.drop_entry, this );
				record.shown = {};
				this.drop_masks( record );
			}, this );
		}, this );
		_.each( _.values( this.textures ), this.destroy_record, this );
		this.textures = {};
		this.live_blocked = false;
		if ( this.current_stack ) this.sync_stack( this.current_stack );
		if ( this.target_stack && this.target_stack !== this.current_stack ) this.sync_stack( this.target_stack );
		this.after_change();
	},

	/**
	 * A Pixi texture of the image at a scale (1 = its natural size).
	 *
	 * Built outside PIXI.Texture.from(), which caches by resource for the whole
	 * page. A downscaled copy comes from createImageBitmap() where the browser
	 * resizes off the main thread, else from a 2D canvas. Bitmaps are created
	 * premultiplied: WebGL ignores the premultiply-on-upload flag Pixi sets for
	 * them, and Pixi draws premultiplied colour.
	 *
	 * @return {Promise<Object|null>} { texture, bitmap }
	 */
	build_texture: function( image, natural, scale, whiten ) {
		var width = Math.max( 1, Math.round( natural.width * scale ) );
		var height = Math.max( 1, Math.round( natural.height * scale ) );
		var that = this;
		var make = function( resource, bitmap ) {
			return that.make_built( resource, bitmap, whiten );
		};
		if ( width >= natural.width && height >= natural.height ) {
			return Promise.resolve( make( image ) );
		}
		var canvas_copy = function() {
			var canvas = that.downscale( image, width, height );
			return canvas ? make( canvas ) : make( image );
		};
		if ( 'function' !== typeof window.createImageBitmap ) return Promise.resolve( canvas_copy() );
		return window.createImageBitmap( image, {
			resizeWidth: width,
			resizeHeight: height,
			resizeQuality: 'high',
			premultiplyAlpha: 'premultiply',
		} ).then( function( bitmap ) {
			// A browser that ignores the resize options hands back the full image.
			if ( bitmap.width !== width || bitmap.height !== height ) {
				bitmap.close();
				return canvas_copy();
			}
			return make( bitmap, bitmap );
		} ).catch( function() {
			return canvas_copy();
		} );
	},

	/**
	 * The image redrawn at a size on a 2D canvas, the way the <img> stack's
	 * capture draws it.
	 *
	 * @return {HTMLCanvasElement|null}
	 */
	downscale: function( image, width, height ) {
		var canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext( '2d' );
		if ( ! context ) return null;
		context.drawImage( image, 0, 0, width, height );
		return canvas;
	},

	destroy_built: function( built ) {
		if ( ! built ) return;
		if ( built.texture ) built.texture.destroy( true );
		if ( built.bitmap && built.bitmap.close ) built.bitmap.close();
	},

	/**
	 * How much of an image's resolution to keep: what one image pixel covers on
	 * screen, in device pixels, rounded up to a step of √2 and never above 1.
	 *
	 * The steps keep a resize from reloading anything until the box has grown
	 * by a whole step; a texture holds at most twice the pixels the box shows.
	 *
	 * @param {Object} stack
	 * @param {Object} natural { width, height } of the image
	 * @return {Number}
	 */
	texture_scale: function( stack, natural ) {
		var resolution = this.app ? this.app.renderer.resolution : 1;
		var shown;
		if ( stack && stack.size && stack.container ) {
			shown = stack.container.scale.x;
		} else {
			// Nothing laid out yet: assume it fits the viewer without upscaling.
			var container = this.$layers && this.$layers.get( 0 );
			var width = container ? container.clientWidth : 0;
			var height = container ? container.clientHeight : 0;
			shown = width && height ? Math.min( 1, width / natural.width, height / natural.height ) : 1;
		}
		return PC.fe.views.viewer_canvas.scale_step( shown * resolution );
	},

	/**
	 * Upgrade the textures a stack draws when its box has outgrown them.
	 */
	check_resolution: function( stack ) {
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				var texture_record = entry.record;
				if ( ! texture_record || texture_record.destroyed ) return;
				var wanted = this.texture_scale( stack, texture_record.natural );
				if ( wanted > texture_record.scale ) this.upgrade_texture( texture_record, wanted );
			}, this );
		}, this );
	},

	touch: function( record ) {
		record.last_used = ++this.texture_clock;
	},

	/**
	 * The texture memory budget, in bytes (decision F in the spec).
	 *
	 * @return {Number}
	 */
	texture_budget: function() {
		var statics = PC.fe.views.viewer_canvas;
		var budget = ( statics.small_screen() ? 96 : 256 ) * 1024 * 1024;
		// A device that says it has little memory gets less, never more.
		var cap = statics.memory_cap();
		if ( cap ) budget = Math.min( budget, cap * 1024 * 1024 );
		/**
		 * Filter how much GPU memory the canvas viewer's textures may use.
		 *
		 * The picture on screen is always kept, even over budget; textures kept
		 * for other angles and preloads are released least recently used first.
		 *
		 * @param {Number} budget In bytes (width × height × 4 per texture).
		 * @param {Backbone.View} viewer
		 */
		return wp.hooks.applyFilters( 'PC.fe.viewer.canvas.texture_budget', budget, this );
	},

	/**
	 * Whether a texture is drawn by the picture on screen, or by the one
	 * being prepared to replace it (held images included).
	 */
	is_pinned: function( record ) {
		var target = this.target_stack;
		var live = this.live_stacks();
		var wanted = function( entry ) {
			return entry.stack === target || _.contains( live, entry.stack );
		};
		return !! (
			_.find( record.entries, wanted )
			|| _.find( this.waiting[ record.url ], wanted )
			// A layer mask in use (sync_mask()).
			|| _.find( record.mask_users, wanted )
		);
	},

	texture_bytes: function() {
		var bytes = 0;
		_.each( this.textures, function( record ) {
			bytes += record.bytes;
		} );
		return bytes;
	},

	/**
	 * Release textures, least recently used first, until under budget.
	 * Pinned textures are never released.
	 */
	enforce_budget: function() {
		if ( this.is_removed ) return;
		var budget = this.texture_budget();
		var total = this.texture_bytes();
		if ( total <= budget ) return;
		var candidates = _.filter( this.textures, function( record ) {
			return record.texture && ! record.destroyed && ! this.is_pinned( record );
		}, this );
		var evict = PC.fe.views.viewer_canvas.pick_evictions( candidates, total, budget );
		_.each( evict, this.evict_texture, this );
		if ( evict.length ) this.request_render();
	},

	/**
	 * Destroy a texture and the sprites drawing it. Those sprites belong to
	 * angles not on screen; showing that angle again loads the image again.
	 */
	evict_texture: function( record ) {
		// Keeping the other angles live does not fit after all: stop until the
		// budget changes (a resize).
		var off_screen = function( item ) {
			return item.stack !== this.current_stack && item.stack !== this.target_stack;
		};
		if ( 'live' === this.mode && ( _.find( record.entries, off_screen, this ) || _.find( record.mask_users, off_screen, this ) ) ) {
			this.live_blocked = true;
			this.mode = 'refresh';
		}
		// A layer mask: the layers it cut lose their images too, so both load
		// again together when their angle is shown, never the images uncut.
		_.each( ( record.mask_users || [] ).slice(), function( user ) {
			var layer_record = user.record;
			if ( ! this.holds_mask( layer_record, user.mask ) || user.mask.texture_record !== record ) return;
			this.drop_held( layer_record );
			_.each( _.values( layer_record.shown ), this.drop_entry, this );
			layer_record.shown = {};
			this.drop_masks( layer_record );
		}, this );
		record.mask_users = [];
		_.each( record.entries.slice(), function( entry ) {
			var layer_record = entry.stack && entry.stack.layers[ entry.model.get( 'layerId' ) ];
			if ( layer_record ) {
				if ( layer_record.shown[ entry.key ] === entry ) delete layer_record.shown[ entry.key ];
				layer_record.held = _.without( layer_record.held, entry );
			}
			this.drop_entry( entry );
		}, this );
		this.destroy_record( record );
	},

	destroy_record: function( record ) {
		record.destroyed = true;
		record.entries = [];
		this.destroy_built( { texture: record.texture, bitmap: record.bitmap } );
		record.texture = null;
		record.bitmap = null;
		record.bytes = 0;
		if ( this.textures[ record.url ] === record ) delete this.textures[ record.url ];
	},

	/**
	 * Hovering or focusing a choice loads its image for the angle being shown.
	 * It may release unpinned textures to fit; it never touches the picture.
	 */
	preload: function( choice ) {
		var stack = this.target_stack;
		if ( ! stack || this.is_removed || choice.get( 'active' ) ) return;
		this.note_activity();
		var url = this.image_url( choice, stack.angle_id );
		if ( ! url ) return;
		var that = this;
		this.load_texture( url, stack, function() {
			return stack === that.target_stack;
		} ).then( function( record ) {
			if ( record && PC.fe.views.viewer_canvas.abandoned !== record ) that.touch( record );
			that.enforce_budget();
		} );
	},

	/**
	 * Eager mode: once the picture is complete, load every image of the angle
	 * in the background, two at a time, while they fit in the free budget.
	 * Never releases anything to make room, and never holds the loading state.
	 */
	start_background: function() {
		this.stop_background();
		var stack = this.current_stack;
		if ( ! stack || stack !== this.target_stack || this.is_removed || this.cover ) return;
		// Other visited angles first, when they are kept live; they queue
		// before eager loads and below anything the customer asks for.
		this.update_mode();
		if ( 'live' === this.mode ) this.sync_others();
		if ( 'lazy' === ( PC.fe.config && PC.fe.config.image_loading_mode || 'lazy' ) ) return;

		var queue = [];
		var seen = {};
		_.each( PC.fe.viewer_state.layers_in_image_order( stack.angle_id ), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;
			choices.each( function( choice ) {
				if ( ! PC.fe.viewer_state.has_drawable( choice ) ) return;
				var url = this.image_url( choice, stack.angle_id );
				if ( ! url || seen[ url ] || this.textures[ url ] ) return;
				seen[ url ] = true;
				queue.push( { url: url, dimensions: choice.get_image( 'image', 'dimensions', stack.angle_id ) } );
			}, this );
		}, this );
		if ( ! queue.length ) return;

		var that = this;
		var job = { stopped: false };
		this.background = job;
		var next = function() {
			if ( job.stopped || that.is_removed ) return;
			var item = queue.shift();
			if ( ! item ) return;
			if ( that.textures[ item.url ] ) return next();
			var estimate = that.estimate_bytes( stack, item.dimensions );
			if ( that.texture_bytes() + estimate > that.texture_budget() ) {
				job.stopped = true;
				return;
			}
			that.load_texture( item.url, stack, function() {
				return ! job.stopped;
			}, function() {
				return true;
			} ).then( next );
		};
		next();
		next();
	},

	stop_background: function() {
		if ( this.background ) this.background.stopped = true;
		this.background = null;
	},

	/**
	 * What a texture will cost before it is loaded, from the stored dimensions.
	 */
	estimate_bytes: function( stack, dimensions ) {
		var width = dimensions && parseInt( dimensions.width );
		var height = dimensions && parseInt( dimensions.height );
		if ( ! width || ! height ) {
			if ( ! stack.size ) return 0;
			width = stack.size.width;
			height = stack.size.height;
		}
		var scale = this.texture_scale( stack, { width: width, height: height } );
		return Math.round( width * scale ) * Math.round( height * scale ) * 4;
	},

	/**
	 * Texture memory, for measuring (the spec's performance run).
	 *
	 * @return {Object} { count, bytes, pinned_bytes, budget }
	 */
	texture_stats: function() {
		var stats = { count: 0, bytes: 0, pinned_bytes: 0, budget: this.texture_budget(), kept_bytes: 0 };
		_.each( this.textures, function( record ) {
			if ( ! record.texture ) return;
			stats.count++;
			stats.bytes += record.bytes;
			// Images not freed after upload (free_source()): held a second time.
			if ( ! record.freed ) stats.kept_bytes += record.bytes;
			if ( this.is_pinned( record ) ) stats.pinned_bytes += record.bytes;
		}, this );
		// Outside the budget: one per angle at most.
		stats.mode = this.mode;
		stats.decoder = this.image_decoder();
		stats.picture_bytes = this.picture_bytes;
		stats.snapshots = _.size( this.snapshots );
		stats.snapshot_bytes = 0;
		_.each( this.snapshots, function( snapshot ) {
			stats.snapshot_bytes += snapshot.bytes;
		} );
		return stats;
	},

	is_cross_origin: function( url ) {
		try {
			return new URL( url, window.location.href ).origin !== window.location.origin;
		} catch ( error ) {
			return false;
		}
	},

	is_stack_settled: function( stack ) {
		return ! _.find( stack.layers, function( record ) {
			if ( this.mask_pending( record ) ) return true;
			return _.find( record.shown, function( entry ) {
				return ! entry.settled;
			} );
		}, this );
	},

	count_loading: function( stack ) {
		var count = 0;
		_.each( stack.layers, function( record ) {
			if ( this.mask_pending( record ) ) count++;
			_.each( record.shown, function( entry ) {
				if ( ! entry.settled ) count++;
			} );
		}, this );
		return count;
	},

	/**
	 * After any change: finish an angle switch whose picture is ready, update
	 * the loading state, draw.
	 */
	after_change: function() {
		if ( this.is_removed ) return;
		if ( this.target_stack && this.target_stack !== this.current_stack && this.is_stack_settled( this.target_stack ) ) {
			this.swap_stacks();
		} else if ( this.cover && this.target_stack === this.current_stack && this.is_stack_settled( this.current_stack ) ) {
			this.reveal();
		}
		this.update_loading();
		this.request_render();
	},

	update_loading: function() {
		var loading = this.target_stack ? this.count_loading( this.target_stack ) : 0;
		this.imagesLoading = loading;
		var was_loading = this.is_loading;
		this.is_loading = 0 < loading;
		this.$el.toggleClass( 'is-loading-image', this.is_loading );
		this.$loading_marker.toggleClass( 'loading', this.is_loading );
		if ( was_loading && ! this.is_loading ) {
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
		if ( ! this.is_loading && ( was_loading || this.background_dirty ) ) {
			this.background_dirty = false;
			this.start_background();
			this.schedule_idle();
		}
	},

	/*
	 * Angles.
	 * --------------------------------------------------------------------- */

	on_angle_change: function( model ) {
		if ( ! model.get( 'active' ) ) return;
		this.show_angle( model.id );
	},

	/**
	 * Switch to an angle. The current picture stays until the new one has
	 * loaded, so the customer never sees a half-built view.
	 */
	show_angle: function( angle_id ) {
		this.stop_background();
		this.note_activity();
		var stack = this.ensure_stack( angle_id );
		stack.last_shown = ++this.show_clock;
		this.target_stack = stack;
		this.sync_stack( stack );
		// Laid out while hidden; its kept textures may be too small for the box
		// now, and they are the most recently used again.
		this.check_resolution( stack );
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				if ( entry.record ) this.touch( entry.record );
			}, this );
		}, this );

		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}

		if ( ! this.current_stack ) {
			this.current_stack = stack;
			stack.container.visible = true;
		} else if ( this.current_stack !== stack ) {
			this.leave_current( stack );
		}
		// Coming back to the angle a cover stands for: the cover stays until
		// that angle is complete again (after_change() reveals it).

		this.layout();
		this.after_change();
	},

	/**
	 * Leave the stack on screen for another angle.
	 *
	 * The outgoing view becomes a flat copy (a cover), so its layers no
	 * longer need to stay in memory while the incoming angle loads. An
	 * incoming angle with a valid flat copy shows at once; otherwise the
	 * cover stays until it is complete (after_change() swaps), or until
	 * PC.fe.viewer.swap_timeout.
	 *
	 * @param {Object} stack The incoming stack.
	 */
	leave_current: function( stack ) {
		this.finish_transition();
		var current = this.current_stack;
		if ( ! this.cover ) {
			var own = this.take_snapshot( current );
			if ( own ) this.cover = this.make_cover( current, own );
		}

		var incoming = this.valid_snapshot( stack );
		if ( incoming ) {
			var from = this.cover ? this.cover_display( this.cover ) : this.stack_display( current );
			this.cover = this.make_cover( stack, incoming );
			this.current_stack = stack;
			this.run_transition( from, this.cover_display( this.cover ), this.is_forward( current, stack ) );
			this.enforce_budget();
			return;
		}

		var that = this;
		this.angle_wait_timer = setTimeout( function() {
			that.swap_stacks();
			that.request_render();
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );
		// Covered, the outgoing angle's textures are no longer pinned.
		this.enforce_budget();
	},

	/**
	 * The current stack is complete: draw it instead of its cover. Same
	 * angle, same pixels, so no transition.
	 */
	reveal: function() {
		if ( ! this.cover ) return;
		// Still moving in: reveal when the transition ends.
		if ( this.transition && this.transition.to.cover === this.cover ) {
			this.transition.then_reveal = true;
			return;
		}
		var cover = this.cover;
		this.cover = null;
		this.current_stack.container.visible = true;
		this.destroy_cover( cover );
		this.request_render();
	},

	/**
	 * Draw the current stack as it is, without its cover (the cover no longer
	 * lines up, or the context was lost).
	 */
	uncover: function() {
		if ( ! this.cover ) return;
		this.finish_transition();
		var cover = this.cover;
		this.cover = null;
		if ( this.current_stack ) this.current_stack.container.visible = true;
		this.destroy_cover( cover );
		this.request_render();
	},

	/**
	 * The stacks drawn live on screen: their textures are pinned.
	 *
	 * @return {Array}
	 */
	live_stacks: function() {
		var live = [];
		if ( this.current_stack && ! this.cover ) live.push( this.current_stack );
		if ( this.transition ) {
			if ( this.transition.from.stack ) live.push( this.transition.from.stack );
			if ( this.transition.to.stack ) live.push( this.transition.to.stack );
		}
		return live;
	},

	/*
	 * Snapshots: flat copies of an angle's picture, at the size it is drawn.
	 * --------------------------------------------------------------------- */

	/**
	 * Where a stack is drawn. A flat copy only lines up with the same one.
	 *
	 * @return {String}
	 */
	layout_key: function( stack ) {
		var renderer = this.app.renderer;
		var container = stack.container;
		return [
			renderer.width,
			renderer.height,
			renderer.resolution,
			Math.round( container.x * 100 ),
			Math.round( container.y * 100 ),
			Math.round( container.scale.x * 1e6 ),
			Math.round( container.scale.y * 1e6 ),
		].join( ',' );
	},

	/**
	 * What a stack would draw now, in order: the files sync_stack() picks.
	 *
	 * @return {String}
	 */
	picture_key: function( stack ) {
		return _.map( this.picture_items( stack ), function( part ) {
			var key = part.url || part.key;
			return part.mask ? key + ' mask:' + part.mask : key;
		} ).join( '\n' );
	},

	/**
	 * What a stack would draw now, in drawing order: layers in image order,
	 * then the choices of a layer by their index (the zIndex of their sprites).
	 *
	 * Each part is { url, mask? } for an image (mask: its layer's mask URL on
	 * that angle), or { item, choice, key, mask? } for an add-on item, whose
	 * key says what it draws (its key(), when it has one) and mask the mask it
	 * is cut with (item_mask_url()).
	 *
	 * @return {Array<Object>}
	 */
	picture_items: function( stack ) {
		return this.parts_of( this.ordered_choices( stack.angle_id ), stack.angle_id );
	},

	/**
	 * The choices drawn now, in drawing order.
	 *
	 * @param {String|Number} angle_id The view: its own order when it has one.
	 * @return {Array<Backbone.Model>}
	 */
	ordered_choices: function( angle_id ) {
		var state = PC.fe.viewer_state;
		var list = [];
		_.each( state.layers_in_image_order( angle_id ), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			var shown = state.shown_choices( layer );
			if ( choices && shown.length > 1 ) {
				shown = _.sortBy( shown, function( choice ) {
					return choices.indexOf( choice );
				} );
			}
			list = list.concat( shown );
		} );
		return list;
	},

	/**
	 * What to draw for each choice at an angle (see picture_items()).
	 *
	 * @param {Array<Backbone.Model>} choices
	 * @param {String|Number} angle_id
	 * @return {Array<Object>}
	 */
	parts_of: function( choices, angle_id ) {
		var state = PC.fe.viewer_state;
		var parts = [];
		_.each( choices, function( choice ) {
			var item = this.canvas_item( choice );
			if ( item ) {
				var key = 'item:' + this.view_key( choice );
				if ( item.key ) {
					try {
						key += ':' + item.key( angle_id );
					} catch ( error ) {
						// A failing key() counts as no change.
					}
				}
				var item_part = { item: item, choice: choice, key: key };
				var item_mask = PC.fe.views.viewer_canvas.item_mask_url( item, PC.fe.layers.get( choice.get( 'layerId' ) ), angle_id );
				if ( item_mask ) item_part.mask = item_mask;
				parts.push( item_part );
				return;
			}
			if ( ! state.has_drawable( choice ) ) return;
			var url = this.image_url( choice, angle_id );
			if ( ! url ) {
				// A colour instead of an image (docs/solid-colour-choices-spec.md).
				var fill = PC.fe.choice_color.fill( choice, angle_id );
				if ( fill ) parts.push( { fill: fill, key: PC.fe.views.viewer_canvas.fill_key( fill ), mask: fill.mask.url } );
				return;
			}
			var part = { url: url };
			// The layer's mask on that angle, if any (docs/layer-masks-spec.md).
			var mask = PC.fe.layer_masks ? PC.fe.layer_masks.get( PC.fe.layers.get( choice.get( 'layerId' ) ), angle_id ) : null;
			if ( mask ) part.mask = mask.url;
			parts.push( part );
		}, this );
		return parts;
	},

	/**
	 * Every entry loaded and no previous image held.
	 */
	is_stack_complete: function( stack ) {
		return this.is_stack_settled( stack ) && ! _.find( stack.layers, function( record ) {
			return record.held.length;
		} );
	},

	/**
	 * A flat copy of a stack on screen, if its picture is complete. Reuses the
	 * stored one when nothing changed.
	 *
	 * @return {Object|null} { angle_id, layout, picture, texture, bytes }
	 */
	take_snapshot: function( stack ) {
		if ( ! stack || ! this.app || ! stack.size || ! stack.container.visible || ! this.is_stack_complete( stack ) ) return null;
		// What an item's key() says must be what the copy shows.
		this.apply_item_updates();
		var layout = this.layout_key( stack );
		var picture = this.picture_key( stack );
		var existing = this.snapshots[ stack.angle_id ];
		if ( existing && existing.layout === layout && existing.picture === picture ) return existing;

		var renderer = this.app.renderer;
		var texture = PIXI.RenderTexture.create( {
			width: renderer.width / renderer.resolution,
			height: renderer.height / renderer.resolution,
			resolution: renderer.resolution,
		} );
		renderer.render( { container: stack.frame, target: texture, clear: true, clearColor: [ 0, 0, 0, 0 ] } );
		this.drop_snapshot( stack.angle_id );
		var snapshot = {
			angle_id: stack.angle_id,
			layout: layout,
			picture: picture,
			texture: texture,
			bytes: texture.source.pixelWidth * texture.source.pixelHeight * 4,
			dropped: false,
			destroyed: false,
		};
		this.snapshots[ stack.angle_id ] = snapshot;
		stack.had_snapshot = true;
		return snapshot;
	},

	/**
	 * The stored flat copy of a stack, if it still shows what the stack would
	 * draw, where it would draw it. A stale one is dropped, never shown.
	 *
	 * @return {Object|null}
	 */
	valid_snapshot: function( stack ) {
		var snapshot = this.snapshots[ stack.angle_id ];
		if ( ! snapshot ) return null;
		if ( stack.size && snapshot.layout === this.layout_key( stack ) && snapshot.picture === this.picture_key( stack ) ) {
			return snapshot;
		}
		this.drop_snapshot( stack.angle_id );
		return null;
	},

	drop_snapshot: function( angle_id ) {
		var snapshot = this.snapshots[ angle_id ];
		if ( ! snapshot ) return;
		delete this.snapshots[ angle_id ];
		snapshot.dropped = true;
		// A cover still drawing it destroys it when it goes.
		if ( ! this.snapshot_in_use( snapshot ) ) this.destroy_snapshot( snapshot );
	},

	destroy_snapshot: function( snapshot ) {
		if ( snapshot.destroyed ) return;
		snapshot.destroyed = true;
		snapshot.texture.destroy( true );
	},

	/**
	 * After a resize: drop the flat copies that no longer line up.
	 */
	prune_snapshots: function() {
		if ( ! this.app ) return;
		_.each( _.keys( this.snapshots ), function( angle_id ) {
			var stack = this.stacks[ angle_id ];
			if ( ! stack || this.snapshots[ angle_id ].layout !== this.layout_key( stack ) ) this.drop_snapshot( angle_id );
		}, this );
	},

	snapshot_in_use: function( snapshot ) {
		var drawn_by = function( cover ) {
			return cover && cover.frame && cover.snapshot === snapshot;
		};
		var transition = this.transition;
		return !! ( drawn_by( this.cover ) || ( transition && ( drawn_by( transition.from.cover ) || drawn_by( transition.to.cover ) ) ) );
	},

	/**
	 * Draw a flat copy in place of a stack.
	 *
	 * @return {Object} The cover: { angle_id, snapshot, frame }
	 */
	make_cover: function( stack, snapshot ) {
		var frame = new PIXI.Container();
		frame.addChild( new PIXI.Sprite( snapshot.texture ) );
		this.app.stage.addChild( frame );
		stack.container.visible = false;
		this.request_render();
		return { angle_id: stack.angle_id, snapshot: snapshot, frame: frame };
	},

	destroy_cover: function( cover ) {
		if ( ! cover || ! cover.frame ) return;
		// The sprite goes, the texture is the snapshot's.
		cover.frame.destroy( { children: true } );
		cover.frame = null;
		if ( cover.snapshot.dropped && ! this.snapshot_in_use( cover.snapshot ) ) this.destroy_snapshot( cover.snapshot );
	},

	/*
	 * Other angles (phase 4b): kept live where the budget allows, their
	 * snapshots refreshed when idle where it does not.
	 * --------------------------------------------------------------------- */

	/**
	 * What one picture costs: the bytes of the textures the current stack draws.
	 */
	picture_cost: function( stack ) {
		var seen = {};
		var bytes = 0;
		_.each( stack.layers, function( record ) {
			_.each( record.shown, function( entry ) {
				var texture_record = entry.record;
				if ( ! texture_record || ! texture_record.texture || seen[ texture_record.url ] ) return;
				seen[ texture_record.url ] = true;
				bytes += texture_record.bytes;
			} );
			// Its masks: the layer's and its items'.
			_.each( [ record.mask ].concat( _.values( record.item_masks ) ), function( mask ) {
				var mask_record = mask && mask.texture_record;
				if ( ! mask_record || ! mask_record.texture || seen[ mask_record.url ] ) return;
				seen[ mask_record.url ] = true;
				bytes += mask_record.bytes;
			} );
		} );
		return bytes;
	},

	/**
	 * Choose how the visited angles not shown are kept:
	 *
	 * - live: they follow choice changes in the background, while one picture
	 *   times the visited angles fits in 75% of the budget (and until it no
	 *   longer fits in all of it, or an eviction says otherwise);
	 * - refresh: their stale snapshots are rebuilt when idle, while one
	 *   picture fits in the budget;
	 * - reload: neither; coming back after a change reloads the angle.
	 *
	 * The picture's cost is measured whenever the shown one is complete.
	 */
	update_mode: function() {
		var stack = this.current_stack;
		if ( stack && stack === this.target_stack && ! this.cover && this.is_stack_complete( stack ) ) {
			var cost = this.picture_cost( stack );
			if ( cost ) this.picture_bytes = cost;
		}
		var picture = this.picture_bytes;
		if ( ! picture ) return this.mode;
		var budget = this.texture_budget();
		var all = picture * _.size( this.stacks );
		var live;
		if ( this.live_blocked ) live = false;
		else if ( 'live' === this.mode ) live = all <= budget;
		else live = all <= 0.75 * budget;
		var mode = live ? 'live' : ( picture <= budget ? 'refresh' : 'reload' );
		/**
		 * Filter how the canvas viewer keeps the angles not shown.
		 *
		 * @param {String} mode    live, refresh or reload.
		 * @param {Backbone.View} viewer
		 * @param {Object} measure { picture, angles, budget } (bytes, count, bytes)
		 */
		mode = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.views_mode', mode, this, { picture: picture, angles: _.size( this.stacks ), budget: budget } );
		if ( 'live' !== mode && 'reload' !== mode ) mode = 'refresh';
		this.mode = mode;
		return mode;
	},

	/**
	 * Bring the visited angles not shown up to date. Their loads are
	 * background work, wanted only while the mode stays live.
	 */
	sync_others: function() {
		_.each( this.stacks, function( stack ) {
			if ( stack === this.current_stack || stack === this.target_stack ) return;
			this.sync_stack( stack );
		}, this );
	},

	/**
	 * The customer did something: a refresh in progress stops, and the idle
	 * delay starts again.
	 */
	note_activity: function() {
		this.stop_refresh();
		this.schedule_idle();
	},

	schedule_idle: function() {
		if ( this.is_removed ) return;
		if ( this.idle_timer ) clearTimeout( this.idle_timer );
		var that = this;
		/**
		 * Filter how long the configurator must be idle before the canvas
		 * viewer refreshes the snapshots of other angles, in milliseconds.
		 *
		 * @param {Number} delay
		 * @param {Backbone.View} viewer
		 */
		var delay = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.idle_delay', 2000, this );
		this.idle_timer = setTimeout( function() {
			that.idle_timer = null;
			that.on_idle();
		}, delay );
	},

	on_idle: function() {
		if ( this.is_removed || ! this.app || this.refresh_job ) return;
		// Still busy: update_loading() starts the delay again once done.
		if ( this.is_loading || this.cover || this.transition || this.current_stack !== this.target_stack ) return;
		if ( 'refresh' !== this.update_mode() ) return;
		if ( window.navigator && navigator.connection && navigator.connection.saveData ) return;
		var stack = this.next_refresh();
		if ( stack ) this.refresh_snapshot( stack );
	},

	/**
	 * The visited angle to refresh next: one that had a snapshot, whose
	 * snapshot is now stale, not refreshed for this picture yet, most recently
	 * shown first.
	 *
	 * @return {Object|null}
	 */
	next_refresh: function() {
		var best = null;
		_.each( this.stacks, function( stack ) {
			if ( stack === this.current_stack || ! stack.size || ! stack.had_snapshot ) return;
			if ( stack.refreshed_for === this.picture_key( stack ) ) return;
			if ( this.valid_snapshot( stack ) ) return;
			if ( ! best || ( stack.last_shown || 0 ) > ( best.last_shown || 0 ) ) best = stack;
		}, this );
		return best;
	},

	/**
	 * Rebuild a stack's snapshot two images at a time, without loading the
	 * stack: each pair is drawn into the new texture at the stack's layout,
	 * then released. Textures are built as the stack would build them, so the
	 * live picture later replaces the snapshot without a visible change.
	 */
	refresh_snapshot: function( stack ) {
		var that = this;
		var abandoned = PC.fe.views.viewer_canvas.abandoned;
		var renderer = this.app.renderer;
		var layout = this.layout_key( stack );
		var picture = this.picture_key( stack );
		var parts = this.picture_items( stack );
		stack.refreshed_for = picture;

		var texture = PIXI.RenderTexture.create( {
			width: renderer.width / renderer.resolution,
			height: renderer.height / renderer.resolution,
			resolution: renderer.resolution,
		} );
		var job = { stopped: false, stack: stack };
		this.refresh_job = job;
		var drawn = 0;
		var wanted = function() {
			return ! job.stopped && ! that.is_removed && !! that.app;
		};
		var background = function() {
			return true;
		};
		var statics = PC.fe.views.viewer_canvas;
		var release = function( items ) {
			_.each( items, function( item ) {
				if ( item && item.built ) that.destroy_built( item.built );
				if ( item && item.mask && item.mask.built ) that.destroy_built( item.mask.built );
				if ( item && item.container ) statics.destroy_item_container( item.item, item.container );
			} );
		};
		var end = function() {
			if ( that.refresh_job === job ) that.refresh_job = null;
		};
		var give_up = function() {
			end();
			if ( ! texture.destroyed ) texture.destroy( true );
		};
		// A texture the viewer holds is used as it is; others are built for this.
		// An item draws a container of its own for this, destroyed after.
		var get_texture = function( url ) {
			var record = that.textures[ url ];
			if ( record && record.texture && ! record.destroyed ) {
				return Promise.resolve( { texture: record.texture, natural: record.natural } );
			}
			return that.fetch_texture( url, function( natural ) {
				return that.texture_scale( stack, natural );
			}, wanted, background ).then( function( result ) {
				if ( ! result || abandoned === result ) return null;
				return { texture: result.built.texture, natural: result.natural, built: result.built };
			} );
		};
		var get = function( part ) {
			// A colour: nothing to load but its mask.
			if ( part.fill ) {
				return get_texture( statics.mask_key( part.mask ) ).then( function( mask ) {
					return { fill: part.fill, mask: mask };
				} );
			}
			if ( part.item ) {
				var drawn_item = statics.draw_item_once( part.item, stack.angle_id, that.item_options( stack ) );
				if ( ! part.mask ) return drawn_item;
				// Cut like on screen (item_mask_url()).
				return Promise.all( [ drawn_item, get_texture( statics.mask_key( part.mask ) ) ] ).then( function( pair ) {
					pair[ 0 ].mask = pair[ 1 ];
					return pair[ 0 ];
				} );
			}
			// A masked image comes with its mask (under its mask key, see whiten()).
			if ( part.mask ) {
				return Promise.all( [ get_texture( part.url ), get_texture( statics.mask_key( part.mask ) ) ] ).then( function( pair ) {
					if ( pair[ 0 ] ) {
						pair[ 0 ].mask = pair[ 1 ];
					} else if ( pair[ 1 ] && pair[ 1 ].built ) {
						that.destroy_built( pair[ 1 ].built );
					}
					return pair[ 0 ];
				} );
			}
			return get_texture( part.url );
		};
		var draw = function( items ) {
			var container = new PIXI.Container();
			container.position.copyFrom( stack.container.position );
			container.scale.copyFrom( stack.container.scale );
			_.each( items, function( item ) {
				// An add-on item: its own container, or nothing at this angle.
				if ( item && item.item ) {
					if ( ! item.container ) return;
					if ( item.mask && item.mask.texture.destroyed ) {
						stack.refreshed_for = null;
						return;
					}
					container.addChild( item.container );
					if ( item.mask ) {
						var item_mask_sprite = new PIXI.Sprite( item.mask.texture );
						that.place_mask_sprite( item_mask_sprite, stack, item.mask );
						container.addChild( item_mask_sprite );
						item.container.mask = item_mask_sprite;
					}
					return;
				}
				// A colour, cut like on screen.
				if ( item && item.fill ) {
					if ( item.mask && item.mask.texture.destroyed ) {
						stack.refreshed_for = null;
						return;
					}
					var fill_sprite = statics.fill_sprite( item.fill );
					fill_sprite.position.set( ( stack.size.width - item.fill.width ) / 2, ( stack.size.height - item.fill.height ) / 2 );
					container.addChild( fill_sprite );
					if ( item.mask ) {
						var fill_mask = new PIXI.Sprite( item.mask.texture );
						that.place_mask_sprite( fill_mask, stack, item.mask );
						container.addChild( fill_mask );
						fill_sprite.mask = fill_mask;
					}
					return;
				}
				// Released meanwhile (a texture the viewer held): the snapshot
				// would miss it, so this refresh does not count.
				if ( ! item || item.texture.destroyed ) {
					if ( item ) stack.refreshed_for = null;
					return;
				}
				// Its mask released meanwhile: never drawn uncut, and this refresh
				// does not count either.
				if ( item.mask && item.mask.texture.destroyed ) {
					stack.refreshed_for = null;
					return;
				}
				var sprite = new PIXI.Sprite( item.texture );
				that.fit_sprite( sprite, item );
				sprite.position.set( ( stack.size.width - item.natural.width ) / 2, ( stack.size.height - item.natural.height ) / 2 );
				container.addChild( sprite );
				if ( item.mask ) {
					var mask_sprite = new PIXI.Sprite( item.mask.texture );
					that.place_mask_sprite( mask_sprite, stack, item.mask );
					container.addChild( mask_sprite );
					sprite.mask = mask_sprite;
				}
			} );
			renderer.render( { container: container, target: texture, clear: 0 === drawn, clearColor: [ 0, 0, 0, 0 ] } );
			drawn++;
			// The sprites go; the textures and items' containers are released by
			// the caller.
			_.each( items, function( item ) {
				if ( item && item.container ) {
					item.container.mask = null;
					container.removeChild( item.container );
				}
			} );
			container.destroy( { children: true } );
		};
		var finish = function() {
			end();
			if ( ! that.app || that.is_removed || layout !== that.layout_key( stack ) || picture !== that.picture_key( stack ) ) {
				if ( ! texture.destroyed ) texture.destroy( true );
				return;
			}
			that.drop_snapshot( stack.angle_id );
			that.snapshots[ stack.angle_id ] = {
				angle_id: stack.angle_id,
				layout: layout,
				picture: picture,
				texture: texture,
				bytes: texture.source.pixelWidth * texture.source.pixelHeight * 4,
				dropped: false,
				destroyed: false,
			};
			// The next stale angle, if the customer is still idle.
			setTimeout( function() {
				that.on_idle();
			}, 0 );
		};
		var step = function( index ) {
			if ( ! wanted() ) return give_up();
			if ( index >= parts.length ) {
				if ( ! drawn ) draw( [] );
				return finish();
			}
			return Promise.all( _.map( parts.slice( index, index + 2 ), get ) ).then( function( items ) {
				if ( ! wanted() ) {
					release( items );
					return give_up();
				}
				draw( items );
				release( items );
				return step( index + 2 );
			} );
		};
		Promise.resolve( step( 0 ) ).catch( function( error ) {
			console.log( 'Product configurator: could not refresh the snapshot of an angle.', error );
			give_up();
		} );
	},

	stop_refresh: function() {
		if ( this.refresh_job ) this.refresh_job.stopped = true;
		this.refresh_job = null;
	},

	/*
	 * Angle transitions.
	 * --------------------------------------------------------------------- */

	stack_display: function( stack ) {
		return {
			frame: stack.frame,
			stack: stack,
			leave: function() {
				stack.container.visible = false;
			},
		};
	},

	cover_display: function( cover ) {
		var that = this;
		return {
			frame: cover.frame,
			cover: cover,
			leave: function() {
				that.destroy_cover( cover );
			},
		};
	},

	/**
	 * Whether the incoming angle comes after the outgoing one, for the
	 * direction of slides.
	 */
	is_forward: function( from_stack, to_stack ) {
		if ( ! from_stack || ! to_stack ) return true;
		var from = PC.fe.angles.indexOf( PC.fe.angles.get( from_stack.angle_id ) );
		var to = PC.fe.angles.indexOf( PC.fe.angles.get( to_stack.angle_id ) );
		return from < 0 || to < 0 || to > from;
	},

	/**
	 * @return {String} visibility, fade, slide-horizontal or slide-vertical.
	 */
	angle_transition: function() {
		/**
		 * Filter how the canvas viewer changes angle.
		 *
		 * @param {String} transition visibility (default, like the <img> stack), fade,
		 *                            slide-horizontal or slide-vertical.
		 * @param {Backbone.View} viewer
		 */
		var transition = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.angle_transition', 'visibility', this );
		if ( window.matchMedia && window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches ) return 'visibility';
		return _.contains( [ 'fade', 'slide-horizontal', 'slide-vertical' ], transition ) ? transition : 'visibility';
	},

	/**
	 * Move from one display (a stack or a cover) to another. The outgoing one
	 * leaves at the end (hidden, or destroyed for a cover).
	 */
	run_transition: function( from, to, forward ) {
		var that = this;
		// The incoming display on top.
		this.app.stage.addChild( to.frame );
		var type = this.angle_transition();
		if ( 'visibility' === type ) {
			from.leave();
			this.request_render();
			return;
		}

		/**
		 * Filter how long an angle transition takes, in milliseconds.
		 *
		 * @param {Number} duration
		 * @param {Backbone.View} viewer
		 */
		var duration = Math.max( 0, wp.hooks.applyFilters( 'PC.fe.viewer.canvas.angle_transition_duration', 350, this ) );
		var renderer = this.app.renderer;
		var width = renderer.width / renderer.resolution;
		var height = renderer.height / renderer.resolution;
		var direction = forward ? 1 : -1;
		var apply = function( progress ) {
			if ( 'fade' === type ) {
				from.frame.alpha = 1 - progress;
				to.frame.alpha = progress;
			} else if ( 'slide-horizontal' === type ) {
				from.frame.x = -progress * width * direction;
				to.frame.x = ( 1 - progress ) * width * direction;
			} else {
				from.frame.y = -progress * height * direction;
				to.frame.y = ( 1 - progress ) * height * direction;
			}
		};

		var transition = { from: from, to: to, frame: null, safety: null, then_reveal: false };
		transition.end = function() {
			if ( that.transition !== transition ) return;
			that.transition = null;
			cancelAnimationFrame( transition.frame );
			clearTimeout( transition.safety );
			_.each( [ from.frame, to.frame ], function( frame ) {
				if ( ! frame || frame.destroyed ) return;
				frame.alpha = 1;
				frame.position.set( 0, 0 );
			} );
			from.leave();
			if ( transition.then_reveal ) that.reveal();
			// The outgoing angle is no longer drawn live.
			that.enforce_budget();
			that.request_render();
		};
		this.transition = transition;
		apply( 0 );

		var start = null;
		var step = function( now ) {
			if ( that.transition !== transition || that.is_removed ) return;
			if ( null === start ) start = now;
			var t = duration ? Math.min( 1, ( now - start ) / duration ) : 1;
			apply( t < 0.5 ? 2 * t * t : -1 + ( 4 - 2 * t ) * t );
			if ( t < 1 ) {
				that.app.render();
				transition.frame = requestAnimationFrame( step );
			} else {
				transition.end();
			}
		};
		transition.frame = requestAnimationFrame( step );
		// Frames do not run in a background tab: end on time anyway.
		transition.safety = setTimeout( transition.end, duration + 250 );
	},

	finish_transition: function() {
		if ( this.transition ) this.transition.end();
	},

	swap_stacks: function() {
		if ( this.angle_wait_timer ) {
			clearTimeout( this.angle_wait_timer );
			this.angle_wait_timer = null;
		}
		var target = this.target_stack;
		if ( ! target || target === this.current_stack ) return;
		this.finish_transition();
		var from = this.cover ? this.cover_display( this.cover ) : this.stack_display( this.current_stack );
		var forward = this.is_forward( this.current_stack, target );
		this.cover = null;
		this.current_stack = target;
		target.container.visible = true;
		this.run_transition( from, this.stack_display( target ), forward );
		// The outgoing angle's textures are no longer pinned.
		this.enforce_budget();
		if ( ! this.is_loading ) this.start_background();
	},

	/*
	 * Custom HTML: always above the images (decision D in the spec).
	 * --------------------------------------------------------------------- */

	add_html_items: function() {
		_.each( PC.fe.viewer_state.layers_in_image_order(), function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return;

			if ( layer.get( 'not_a_choice' ) ) {
				var choice = choices.first();
				if ( ! choice || ! choice.get( 'custom_html' ) ) return;
				var content;
				try {
					content = $( choice.get( 'custom_html' ) );
				} catch ( error ) {
					content = $( '<div class="mkl-custom-html--container" />' );
					content.html( choice.get( 'custom_html' ) );
				}
				this.$loading_marker.before( content );
				this.html_items.push( { $el: content, remove: function() { content.remove(); } } );
				return;
			}

			choices.each( function( choice ) {
				if ( ! choice.get( 'custom_html' ) ) return;
				var html_view = new PC.fe.views.viewer_layer_html( { model: choice, layer: false, parent: this } );
				this.$loading_marker.before( html_view.$el );
				this.html_items.push( html_view );
				wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_view, this );
			}, this );
		}, this );
	},

	/*
	 * Drawing.
	 * --------------------------------------------------------------------- */

	/**
	 * Draw on the next frame. The viewer only draws when something changed.
	 */
	request_render: function() {
		if ( this.render_frame || ! this.app || this.is_removed ) return;
		var that = this;
		this.render_frame = requestAnimationFrame( function() {
			that.render_frame = null;
			if ( ! that.app || that.is_removed ) return;
			that.apply_item_updates();
			that.app.render();
		} );
	},

	on_context_lost: function() {
		// A render texture's content does not survive a lost context, and
		// Pixi cannot upload it again: the flat copies go.
		this.finish_transition();
		this.uncover();
		this.stop_refresh();
		_.each( _.keys( this.snapshots ), this.drop_snapshot, this );
		wp.hooks.doAction( 'PC.fe.viewer.context.lost', this, null );
		var that = this;
		if ( this.context_timer ) clearTimeout( this.context_timer );
		this.context_timer = setTimeout( function() {
			that.context_timer = null;
			that.fall_back( 'context_lost' );
		}, 3000 );
	},

	on_context_restored: function() {
		if ( this.context_timer ) clearTimeout( this.context_timer );
		this.context_timer = null;
		this.reload_textures();
		wp.hooks.doAction( 'PC.fe.viewer.context.restored', this, null );
		this.request_render();
	},

	/*
	 * Capture (the viewer contract in configurator.js).
	 * --------------------------------------------------------------------- */

	/**
	 * Render the current configuration to a PNG blob, off screen.
	 *
	 * What to draw comes from the models, as for every viewer. Resolves null -
	 * never a partial picture - when an image of the picture cannot be loaded.
	 *
	 * @param {Object} [options] { width, height, maxDimension }
	 * @return {Promise<Blob|null>}
	 */
	capture: async function( options ) {
		options = options || {};
		await this.ready;
		if ( ! this.app || this.is_removed ) return null;

		var angle = PC.fe.angles.findWhere( { active: true } ) || PC.fe.angles.first();
		if ( ! angle ) return null;
		var state = PC.fe.viewer_state;

		/** This filter is documented in viewer.js (get_capture_models). */
		var models = wp.hooks.applyFilters( 'PC.fe.viewer.capture.models', state.picture( angle.id ), this );

		var parts = this.parts_of( models, angle.id );
		if ( ! parts.length ) return null;

		var size = this.angle_size( angle.id ) || ( this.stacks[ angle.id ] && this.stacks[ angle.id ].size );
		if ( ! size ) {
			// No stored dimensions and nothing shown yet: the first image decides.
			var first_image = _.find( parts, function( part ) {
				return part.url || part.fill;
			} );
			if ( ! first_image ) return null;
			if ( first_image.fill ) {
				size = { width: first_image.fill.width, height: first_image.fill.height };
			} else {
				var first = await this.load_image( first_image.url );
				if ( ! first ) return null;
				size = { width: first.naturalWidth, height: first.naturalHeight };
			}
		}
		if ( this.is_removed || ! this.app || ! size.width || ! size.height ) return null;

		var width = size.width;
		var height = size.height;
		var max_dimension = options.maxDimension || wp.hooks.applyFilters( 'PC.fe.pdf.max_dimension', 1200 );
		if ( options.width && options.height ) {
			width = options.width;
			height = options.height;
		} else if ( width > max_dimension || height > max_dimension ) {
			var ratio = height / width;
			if ( height > width ) {
				height = max_dimension;
				width = height / ratio;
			} else {
				width = max_dimension;
				height = width * ratio;
			}
		}
		width = Math.round( width );
		height = Math.round( height );
		var scale_x = width / size.width;
		var scale_y = height / size.height;

		// Drawn a few images at a time into one render texture, each resized
		// first the way the <img> stack's capture resizes it, so memory stays at
		// a few output-sized images however many layers the picture has. Items
		// draw a container of their own for it, at the output's resolution.
		var renderer = this.app.renderer;
		var target = PIXI.RenderTexture.create( { width: width, height: height, resolution: 1 } );
		var batch_size = this.decode_limit();
		var item_options = { size: size, resolution: Math.max( scale_x, scale_y ), capture: true };
		var statics = PC.fe.views.viewer_canvas;
		var that = this;
		var drawn = 0;
		var failed = false;
		var canvas;
		var context;
		try {
			for ( var start = 0; start < parts.length && ! failed; start += batch_size ) {
				var slice = parts.slice( start, start + batch_size );
				var images = await Promise.all( _.map( slice, function( part ) {
					if ( part.item ) return statics.draw_item_once( part.item, angle.id, item_options );
					// A colour has nothing to load (docs/solid-colour-choices-spec.md).
					if ( part.fill ) return { fill: part.fill };
					return that.load_image( part.url );
				} ) );
				// Layer masks, loaded again like the images; one that cannot load
				// leaves its image unmasked (docs/layer-masks-spec.md).
				var masks = await Promise.all( _.map( slice, function( part ) {
					return part.mask ? that.load_image( part.mask ) : null;
				} ) );
				var release_masks = function() {
					_.each( masks, function( mask ) {
						if ( mask ) that.release_image( mask );
					} );
				};
				if ( this.is_removed || ! this.app ) {
					statics.release_drawn_items( images );
					release_masks();
					return null;
				}
				if ( _.contains( images, null ) ) {
					failed = true;
					statics.release_drawn_items( images );
					release_masks();
					_.each( images, function( image ) {
						if ( image && ! image.item && ! image.fill ) this.release_image( image );
					}, this );
					break;
				}
				var batch = new PIXI.Container();
				var made = [];
				// A mask at the output's scale, as opaque grey (whiten()), or null.
				var mask_sprite_for = function( index ) {
					var mask_image = masks[ index ];
					if ( ! mask_image || ! mask_image.naturalWidth ) return null;
					var mask_natural = { width: mask_image.naturalWidth, height: mask_image.naturalHeight };
					var white = statics.whiten( mask_image, Math.max( 1, Math.round( mask_natural.width * scale_x ) ), Math.max( 1, Math.round( mask_natural.height * scale_y ) ) );
					if ( ! white ) return null;
					var mask_texture = new PIXI.Texture( { source: new PIXI.ImageSource( { resource: white } ) } );
					made.push( mask_texture );
					var mask_sprite = new PIXI.Sprite( mask_texture );
					mask_sprite.scale.set( mask_natural.width * scale_x / mask_texture.width, mask_natural.height * scale_y / mask_texture.height );
					mask_sprite.position.set( ( size.width - mask_natural.width ) / 2 * scale_x, ( size.height - mask_natural.height ) / 2 * scale_y );
					batch.addChild( mask_sprite );
					return mask_sprite;
				};
				_.each( images, function( image, index ) {
					if ( image.item ) {
						if ( ! image.container ) return;
						// The item draws in the angle's pixels; the output is scaled.
						var holder = new PIXI.Container();
						holder.scale.set( scale_x, scale_y );
						holder.addChild( image.container );
						batch.addChild( holder );
						// Cut like on screen (item_mask_url()).
						var item_mask = mask_sprite_for( index );
						if ( item_mask ) holder.mask = item_mask;
						return;
					}
					if ( image.fill ) {
						var fill_sprite = statics.fill_sprite( image.fill, scale_x, scale_y );
						fill_sprite.position.set( ( size.width - image.fill.width ) / 2 * scale_x, ( size.height - image.fill.height ) / 2 * scale_y );
						batch.addChild( fill_sprite );
						var fill_mask = mask_sprite_for( index );
						if ( fill_mask ) fill_sprite.mask = fill_mask;
						return;
					}
					var natural = { width: image.naturalWidth, height: image.naturalHeight };
					var out_width = Math.max( 1, Math.round( natural.width * scale_x ) );
					var out_height = Math.max( 1, Math.round( natural.height * scale_y ) );
					var smaller = out_width < natural.width || out_height < natural.height;
					var resource = smaller ? this.downscale( image, out_width, out_height ) || image : image;
					var texture = new PIXI.Texture( { source: new PIXI.ImageSource( { resource: resource } ) } );
					made.push( texture );
					var sprite = new PIXI.Sprite( texture );
					sprite.scale.set( natural.width * scale_x / texture.width, natural.height * scale_y / texture.height );
					sprite.position.set( ( size.width - natural.width ) / 2 * scale_x, ( size.height - natural.height ) / 2 * scale_y );
					batch.addChild( sprite );

					// Each image its own mask (decision 7).
					var image_mask = mask_sprite_for( index );
					if ( image_mask ) sprite.mask = image_mask;
				}, this );
				renderer.render( { container: batch, target: target, clear: 0 === drawn, clearColor: [ 0, 0, 0, 0 ] } );
				drawn += images.length;
				// Items' containers go the item's way, before the batch goes.
				_.each( images, function( image ) {
					if ( image.item && image.container && image.container.parent ) {
						image.container.parent.mask = null;
						image.container.parent.removeChild( image.container );
					}
				} );
				statics.release_drawn_items( images );
				batch.destroy( { children: true } );
				_.each( made, function( texture ) {
					texture.destroy( true );
				} );
				_.each( images, function( image ) {
					if ( ! image.item && ! image.fill ) this.release_image( image );
				}, this );
				release_masks();
			}
			if ( failed ) {
				console.log( 'Product configurator: cannot capture the configuration, an image could not be loaded.' );
				return null;
			}

			canvas = this.target_to_canvas( target );
			context = canvas.getContext( '2d' );
		} catch ( error ) {
			console.log( 'Product configurator: could not compose the captured image.', error );
			return null;
		} finally {
			target.destroy( true );
		}

		/** This action is documented in viewer.js (capture). */
		wp.hooks.doAction( 'PC.fe.viewer.capture.canvas', context, canvas, this );

		return new Promise( function( resolve ) {
			try {
				canvas.toBlob( function( blob ) { resolve( blob || null ); }, 'image/png' );
			} catch ( error ) {
				console.log( 'Product configurator: the captured canvas could not be exported.', error );
				resolve( null );
			}
		} );
	},

	/**
	 * Draw a container off screen into a 2D canvas, with straight alpha.
	 *
	 * For add-ons that need a picture of their own (text overlay sends its
	 * text as a PNG with the cart item) without a WebGL context of their own.
	 * The container is drawn at its own transform; nothing on screen changes.
	 *
	 * @param {PIXI.Container} container
	 * @param {Number} width  Output pixels.
	 * @param {Number} height
	 * @return {HTMLCanvasElement|null}
	 */
	render_to_canvas: function( container, width, height ) {
		if ( ! this.app || this.is_removed || ! width || ! height ) return null;
		var target = PIXI.RenderTexture.create( { width: Math.round( width ), height: Math.round( height ), resolution: 1 } );
		try {
			this.app.renderer.render( { container: container, target: target, clear: true, clearColor: [ 0, 0, 0, 0 ] } );
			return this.target_to_canvas( target );
		} catch ( error ) {
			console.log( 'Product configurator: could not draw an add-on picture.', error );
			return null;
		} finally {
			target.destroy( true );
		}
	},

	/**
	 * A render texture's pixels in a new 2D canvas.
	 *
	 * @param {PIXI.RenderTexture} target
	 * @return {HTMLCanvasElement}
	 */
	target_to_canvas: function( target ) {
		var extracted = this.app.renderer.extract.pixels( { target: target } );
		var canvas = document.createElement( 'canvas' );
		canvas.width = extracted.width;
		canvas.height = extracted.height;
		canvas.getContext( '2d' ).putImageData( this.unpremultiply( extracted.pixels, extracted.width, extracted.height ), 0, 0 );
		return canvas;
	},

	/**
	 * Pixels read back from WebGL as a straight-alpha ImageData.
	 *
	 * Pixi 8.16's extract returns premultiplied colour (a 200 grey at alpha 74
	 * comes back as 58), and does not convert it, so semi-transparent edges came
	 * out darker than on screen and than the <img> stack's capture.
	 *
	 * @param {Uint8ClampedArray} pixels Premultiplied RGBA.
	 * @param {Number} width
	 * @param {Number} height
	 * @return {ImageData}
	 */
	unpremultiply: function( pixels, width, height ) {
		var image = new ImageData( width, height );
		var data = image.data;
		for ( var i = 0; i < pixels.length; i += 4 ) {
			var alpha = pixels[ i + 3 ];
			if ( 0 === alpha ) continue;
			if ( 255 === alpha ) {
				data[ i ] = pixels[ i ];
				data[ i + 1 ] = pixels[ i + 1 ];
				data[ i + 2 ] = pixels[ i + 2 ];
			} else {
				var factor = 255 / alpha;
				data[ i ] = pixels[ i ] * factor;
				data[ i + 1 ] = pixels[ i + 1 ] * factor;
				data[ i + 2 ] = pixels[ i + 2 ] * factor;
			}
			data[ i + 3 ] = alpha;
		}
		return image;
	},

	/*
	 * Falling back and tearing down.
	 * --------------------------------------------------------------------- */

	/**
	 * Replace this viewer with the <img> stack, for the rest of the page view.
	 *
	 * @param {String} reason webgl | cors | context_lost
	 * @param {*}      [detail]
	 */
	fall_back: function( reason, detail ) {
		if ( this.is_removed ) return;
		PC.fe.views.viewer_canvas.disabled = { reason: reason, detail: detail };
		PC.fe.views.viewer_canvas.report_fallback( reason, detail, this );

		var modal = PC.fe.modal;
		if ( ! modal || modal.viewer !== this ) {
			this.remove();
			return;
		}

		var View = wp.hooks.applyFilters( 'PC.fe.viewer.main_view', PC.fe.views.viewer );
		var replacement = new View( { parent: modal } );
		var $rendered = replacement.render();
		var own = this.own_children;
		var $foreign = this.$el.children().filter( function() {
			return -1 === own.indexOf( this );
		} );
		$rendered.append( $foreign );
		this.$el.replaceWith( $rendered );
		modal.viewer = replacement;
		this.remove();
	},

	remove: function() {
		this.is_removed = true;
		if ( this.render_frame ) cancelAnimationFrame( this.render_frame );
		this.render_frame = null;
		if ( this.angle_wait_timer ) clearTimeout( this.angle_wait_timer );
		if ( this.context_timer ) clearTimeout( this.context_timer );
		if ( this.resolution_timer ) clearTimeout( this.resolution_timer );
		if ( this.transition ) {
			cancelAnimationFrame( this.transition.frame );
			clearTimeout( this.transition.safety );
			this.transition = null;
		}
		this.cover = null;
		if ( this.idle_timer ) clearTimeout( this.idle_timer );
		this.idle_timer = null;
		this.stop_refresh();
		_.each( this.snapshots, function( snapshot ) {
			snapshot.texture.destroy( true );
		} );
		this.snapshots = {};
		this.stop_background();
		// Let the waiting loads run: each sees is_removed and gives up.
		var waiting = this.decode_queue;
		this.decode_queue = [];
		_.each( waiting, function( waiter ) {
			waiter.give_up();
		} );
		if ( this.resize_observer ) this.resize_observer.disconnect();
		this.resize_observer = null;
		this.stopListening();

		_.each( this.stacks, function( stack ) {
			_.each( stack.layers, function( record ) {
				if ( record.hold_timer ) clearTimeout( record.hold_timer );
				// Items clean up their containers while the renderer is there.
				_.each( record.shown, function( entry ) {
					if ( entry.item ) this.drop_entry( entry );
				}, this );
				_.each( record.held, function( entry ) {
					if ( entry.item ) this.drop_entry( entry );
				}, this );
			}, this );
		}, this );
		_.each( _.compact( _.values( this.items ) ), function( item ) {
			try {
				if ( item.destroy ) item.destroy();
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not clean up.', error );
			}
		} );
		this.items = {};
		this.dirty_items = [];
		this.stacks = {};
		this.current_stack = null;
		this.target_stack = null;

		_.each( this.html_items, function( item ) {
			item.remove();
		} );
		this.html_items = [];
		if ( this.angles_selector ) this.angles_selector.remove();

		// Textures first, while the renderer can still release their GPU copies;
		// the sprites go with the stage.
		_.each( _.values( this.textures ), this.destroy_record, this );
		this.textures = {};
		this.waiting = {};

		if ( this.app ) {
			var canvas = this.app.canvas;
			canvas.removeEventListener( 'webglcontextlost', this.on_context_lost );
			canvas.removeEventListener( 'webglcontextrestored', this.on_context_restored );
			this.app.destroy( { removeView: true }, { children: true } );
			this.app = null;
		}

		return Backbone.View.prototype.remove.apply( this, arguments );
	}
}, {

	/**
	 * Set once the canvas viewer had to give up on this page view; every later
	 * mount uses the <img> stack. { reason, detail } or null.
	 */
	disabled: null,

	/**
	 * What load_texture() resolves with when its decode was given up because
	 * nobody wanted the image any more.
	 */
	abandoned: { abandoned: true },

	/**
	 * The key a layer mask's texture is loaded under: the file's URL with a
	 * fragment, which no request carries (the HTTP cache is shared with the file
	 * used as an image) but which keeps the mask texture (see whiten()) apart from the
	 * same file's image texture.
	 *
	 * @param {String} url
	 * @return {String}
	 */
	mask_key: function( url ) {
		return url + '#pc-mask';
	},

	/**
	 * What a colour part draws, for picture keys and entry changes: its colour and size.
	 *
	 * @param {Object} fill From PC.fe.choice_color.fill().
	 * @return {String}
	 */
	fill_key: function( fill ) {
		return 'fill:' + fill.color + ':' + fill.width + 'x' + fill.height;
	},

	/**
	 * A colour as a sprite: Pixi's shared white texture, tinted, at the given size (the
	 * mask's natural size, times the output's scale for a capture). Destroying the sprite
	 * leaves the shared texture alone.
	 *
	 * @param {Object} fill   { color, width, height }
	 * @param {Number} [scale_x]
	 * @param {Number} [scale_y]
	 * @return {PIXI.Sprite}
	 */
	fill_sprite: function( fill, scale_x, scale_y ) {
		var sprite = new PIXI.Sprite( PIXI.Texture.WHITE );
		sprite.tint = fill.color;
		sprite.width = fill.width * ( scale_x || 1 );
		sprite.height = fill.height * ( scale_y || 1 );
		return sprite;
	},

	destroy_sprite: function( sprite ) {
		if ( ! sprite || sprite.destroyed ) return;
		if ( sprite.parent ) sprite.parent.removeChild( sprite );
		sprite.destroy();
	},

	is_mask_key: function( url ) {
		return /#pc-mask$/.test( String( url || '' ) );
	},

	/**
	 * The mask an add-on item is cut with at an angle, as a URL ('' for none).
	 *
	 * An item without a mask() method, or whose mask() returns undefined, is
	 * cut by its layer's mask, like the layer's images. mask() returning a URL
	 * cuts it with that mask instead; returning '' or null, with none. The mask
	 * follows the layer masks' rules: an alpha PNG the size of the angle's
	 * images, centred like them (docs/layer-masks-spec.md).
	 *
	 * @param {Object}         item
	 * @param {Backbone.Model} layer
	 * @param {Number|String}  angle_id
	 * @return {String}
	 */
	item_mask_url: function( item, layer, angle_id ) {
		var own;
		if ( item && 'function' === typeof item.mask ) {
			try {
				own = item.mask( angle_id );
			} catch ( error ) {
				own = undefined;
			}
		}
		if ( undefined !== own ) return own ? String( own ) : '';
		var image = PC.fe.layer_masks && layer ? PC.fe.layer_masks.get( layer, angle_id ) : null;
		return image && image.url ? image.url : '';
	},

	/**
	 * A mask redrawn the way Pixi's sprite mask reads it: opaque, grey = the
	 * mask's alpha (white where it shows, black where it hides).
	 *
	 * Pixi 8.16's mask filter keeps `mask.a * mask.r` of a premultiplied
	 * texture. A white mask with alpha a gives a * a: soft edges came out
	 * squared (a 50% edge at 25%). Opaque grey gives 1 * a, exactly the alpha
	 * the <img> stack and the server merge use.
	 *
	 * @param {CanvasImageSource} resource
	 * @param {Number} [width]  Defaults to the resource's own size.
	 * @param {Number} [height]
	 * @return {HTMLCanvasElement|null}
	 */
	whiten: function( resource, width, height ) {
		width = width || resource.naturalWidth || resource.width;
		height = height || resource.naturalHeight || resource.height;
		if ( ! width || ! height ) return null;
		var canvas = document.createElement( 'canvas' );
		canvas.width = width;
		canvas.height = height;
		var context = canvas.getContext( '2d' );
		if ( ! context ) return null;
		context.drawImage( resource, 0, 0, width, height );
		// White where the mask is, with its alpha...
		context.globalCompositeOperation = 'source-in';
		context.fillStyle = '#fff';
		context.fillRect( 0, 0, width, height );
		// ...over black: opaque, grey = alpha.
		context.globalCompositeOperation = 'destination-over';
		context.fillStyle = '#000';
		context.fillRect( 0, 0, width, height );
		return canvas;
	},

	/**
	 * Ask add-ons for the item drawing a choice in the scene.
	 *
	 * An item is an object:
	 *   create( angle_id, options ) -> PIXI.Container|null  Required. The choice
	 *       drawn for an angle, in the pixels of the angle's image (the viewer
	 *       scales it with the stack). null: nothing at this angle. Called for
	 *       each angle shown, and again for one-off drawings (capture, the idle
	 *       snapshot refresh) that are destroyed right after.
	 *       options: { size, resolution, capture }: the angle's image size
	 *       ({ width, height }, or null before it is known), device pixels per
	 *       image pixel (for text resolution), whether it is for a capture.
	 *   update( container, angle_id, options )  Optional. Bring a container in
	 *       line with the item after context.request_render(), or when the
	 *       options changed (a resize).
	 *   key( angle_id ) -> String  Optional. What it draws at that angle; when
	 *       it changes, flat copies of other angles are redrawn. Without it,
	 *       those copies keep the old drawing.
	 *   ready( angle_id ) -> Promise  Optional. Resolves once it can draw
	 *       properly (fonts loaded); the picture counts as loading until then.
	 *   destroy_container( container )  Optional. Before the viewer destroys a
	 *       container (with its children).
	 *   destroy()  Optional. The viewer goes.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Object} context { viewer, layer, request_render() }; viewer is
	 *                         null when only asking whether there is an item.
	 * @return {Object|null}
	 */
	ask_item: function( choice, context ) {
		var item = wp.hooks.applyFilters( 'PC.fe.viewer.canvas.item', null, choice, context );
		return item && 'function' === typeof item.create ? item : null;
	},

	/**
	 * A one-off drawing of an item, once it is ready.
	 *
	 * @return {Promise<Object>} { item, container } (container may be null)
	 */
	draw_item_once: function( item, angle_id, options ) {
		var ready;
		try {
			ready = item.ready ? item.ready( angle_id ) : null;
		} catch ( error ) {
			ready = null;
		}
		var draw = function() {
			var container = null;
			try {
				container = item.create( angle_id, options ) || null;
			} catch ( error ) {
				console.log( 'Product configurator: an add-on item could not be drawn.', error );
			}
			return { item: item, container: container };
		};
		return Promise.resolve( ready ).then( draw, draw );
	},

	release_drawn_items: function( drawn ) {
		_.each( drawn, function( entry ) {
			if ( entry && entry.item && entry.container ) {
				PC.fe.views.viewer_canvas.destroy_item_container( entry.item, entry.container );
				entry.container = null;
			}
		} );
	},

	destroy_item_container: function( item, container ) {
		if ( container.destroyed ) return;
		try {
			if ( item.destroy_container ) item.destroy_container( container );
		} catch ( error ) {
			console.log( 'Product configurator: an add-on item could not clean up.', error );
		}
		if ( container.parent ) container.parent.removeChild( container );
		container.destroy( { children: true } );
	},

	/**
	 * Whether the configurator is narrower than the mobile image breakpoint,
	 * where the stack switches to mobile images: smaller budgets apply there.
	 *
	 * @return {Boolean}
	 */
	small_screen: function() {
		var config = PC.fe.config || {};
		var width = PC.fe.modal && PC.fe.modal.$el ? PC.fe.modal.$el.outerWidth() : 0;
		return !! ( width && config.mobile_image_breakpoint && width < config.mobile_image_breakpoint );
	},

	/**
	 * The most texture memory the device's own memory allows, in MiB, or 0 for
	 * no limit. Only Chromium browsers report it (navigator.deviceMemory,
	 * rounded, at most 8), so Safari and Firefox always get 0. It only ever
	 * lowers the budget: the breakpoint rule is what was measured.
	 *
	 * @return {Number}
	 */
	memory_cap: function() {
		var memory = window.navigator && navigator.deviceMemory;
		if ( ! ( memory > 0 ) ) return 0;
		if ( memory <= 2 ) return 64;
		if ( memory <= 4 ) return 128;
		return 0;
	},

	/**
	 * Round a texture scale up to the next step of √2, capped at 1 (full size).
	 *
	 * @param {Number} scale Device pixels per image pixel.
	 * @return {Number}
	 */
	scale_step: function( scale ) {
		if ( ! ( scale > 0 ) || scale >= 1 ) return 1;
		// The epsilon keeps an exact step (0.5) from rounding up to the next one.
		var step = Math.ceil( 2 * Math.log2( scale ) - 1e-9 ) / 2;
		return Math.min( 1, Math.pow( 2, step ) );
	},

	/**
	 * Which textures to release, least recently used first, to get under the
	 * budget. Over budget with nothing left to release is allowed: the picture
	 * on screen always shows.
	 *
	 * @param {Array}  candidates Unpinned records ({ bytes, last_used }).
	 * @param {Number} total      Bytes used now.
	 * @param {Number} budget
	 * @return {Array} The records to release.
	 */
	pick_evictions: function( candidates, total, budget ) {
		var sorted = candidates.slice().sort( function( a, b ) {
			return a.last_used - b.last_used;
		} );
		var evict = [];
		for ( var i = 0; i < sorted.length && total > budget; i++ ) {
			evict.push( sorted[ i ] );
			total -= sorted[ i ].bytes;
		}
		return evict;
	},

	/**
	 * The 2D renderer requested for this product: 'dom' or 'canvas'.
	 *
	 * @return {String}
	 */
	renderer: function() {
		var renderer = ( PC.fe.config && PC.fe.config.viewer_2d_renderer ) || 'dom';
		/**
		 * Filter the 2D renderer: 'dom' (the <img> stack) or 'canvas'.
		 *
		 * @param {String} renderer
		 * @param {Object} product_data PC.fe.currentProductData
		 */
		renderer = wp.hooks.applyFilters( 'PC.fe.viewer.renderer', renderer, PC.fe.currentProductData );
		return 'canvas' === renderer ? 'canvas' : 'dom';
	},

	/**
	 * Why the canvas viewer cannot show this product, or null when it can.
	 *
	 * @return {Object|null} { reason, detail }
	 */
	unsupported_reason: function() {
		if ( this.disabled ) return this.disabled;
		// Pixi on the page, or one it can load (load_pixi()).
		if ( ! this.has_pixi() && ! this.pixi_url() ) {
			return { reason: 'pixi_missing' };
		}
		var webgl = ( this.has_pixi() && PIXI.isWebGLSupported ) ? PIXI.isWebGLSupported() : this.webgl_supported();
		if ( ! webgl ) {
			return { reason: 'webgl' };
		}

		// A layer an add-on draws as DOM (its own item view) cannot be put in the
		// scene, unless the add-on also gives a canvas item for it; otherwise
		// the whole product uses the <img> stack instead (decision C).
		if ( ! PC.fe.layers || ! PC.fe.contents ) return null;
		var that = this;
		var dom_layer = PC.fe.layers.find( function( layer ) {
			var choices = PC.fe.getLayerContent( layer.id );
			if ( ! choices ) return false;
			return choices.find( function( choice ) {
				if ( PC.fe.views.viewer_layer === wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, choice, null ) ) return false;
				return ! that.ask_item( choice, { viewer: null, layer: layer, request_render: function() {} } );
			} );
		} );
		if ( dom_layer ) {
			return { reason: 'dom_item_view', detail: dom_layer.get( 'admin_label' ) || dom_layer.get( 'name' ) || dom_layer.id };
		}
		return null;
	},

	/*
	 * Pixi on demand: not a script dependency of the configurator, so its ~220 KB (gzipped) never
	 * block the page. The viewer loads it when it starts; on canvas products it is also fetched in
	 * the background once the page has loaded, so a configurator opened later finds it ready.
	 * Add-ons drawing with Pixi call load_pixi() too. A `pixijs` script already on the page (an
	 * add-on depending on the handle) is used as it is.
	 * --------------------------------------------------------------------- */

	pixi_loading: null,

	has_pixi: function() {
		return 'undefined' !== typeof PIXI && !! PIXI.Application && !! PIXI.Texture;
	},

	/**
	 * Where Pixi is: PC.fe.config.pixi_url (mkl_pc_pixi_url()), or '' when the page has none.
	 *
	 * @return {String}
	 */
	pixi_url: function() {
		var config = PC.fe.config || ( window.PC_config && PC_config.config ) || {};
		return config.pixi_url || '';
	},

	/**
	 * Load Pixi once. Resolves true when PIXI is usable, false when it could not be loaded.
	 *
	 * @return {Promise<Boolean>}
	 */
	load_pixi: function() {
		var that = this;
		if ( this.has_pixi() ) return Promise.resolve( true );
		if ( this.pixi_loading ) return this.pixi_loading;
		// A copy enqueued by an add-on, printed after the configurator's script and not run yet.
		var script = document.getElementById( 'pixijs-js' );
		var url = this.pixi_url();
		if ( ! script && ! url ) return Promise.resolve( false );
		this.pixi_loading = new Promise( function( resolve ) {
			var settle = function() {
				resolve( that.has_pixi() );
			};
			if ( ! script ) {
				script = document.createElement( 'script' );
				script.id = 'pixijs-js';
				script.async = true;
				script.src = url;
				document.head.appendChild( script );
			}
			script.addEventListener( 'load', settle );
			script.addEventListener( 'error', function() {
				console.log( 'Product configurator: Pixi could not be loaded from ' + ( script.src || url ) + '.' );
				that.pixi_loading = null;
				resolve( false );
			} );
		} );
		return this.pixi_loading;
	},

	/**
	 * Fetch Pixi once the page has loaded and the browser is idle, on canvas products.
	 */
	preload_pixi: function() {
		var that = this;
		var start = function() {
			if ( 'canvas' !== that.renderer() || that.has_pixi() || ! that.pixi_url() ) return;
			if ( window.requestIdleCallback ) {
				window.requestIdleCallback( function() {
					that.load_pixi();
				}, { timeout: 2000 } );
			} else {
				setTimeout( function() {
					that.load_pixi();
				}, 200 );
			}
		};
		if ( 'complete' === document.readyState ) {
			start();
		} else {
			window.addEventListener( 'load', start, { once: true } );
		}
	},

	/**
	 * WebGL without Pixi (before it is loaded): a context can be created. Pixi's own check
	 * runs again in start(), once it is.
	 *
	 * @return {Boolean}
	 */
	webgl_supported: function() {
		if ( undefined !== this.webgl_cache ) return this.webgl_cache;
		var supported = false;
		try {
			var canvas = document.createElement( 'canvas' );
			var gl = canvas.getContext( 'webgl2' ) || canvas.getContext( 'webgl' );
			supported = !! gl;
			var lose = gl && gl.getExtension( 'WEBGL_lose_context' );
			if ( lose ) lose.loseContext();
		} catch ( error ) {
			supported = false;
		}
		this.webgl_cache = supported;
		return supported;
	},

	report_fallback: function( reason, detail, viewer ) {
		var messages = {
			pixi_missing: 'Pixi is not loaded',
			webgl: 'WebGL is not available',
			dom_item_view: 'the layer "' + detail + '" is drawn by an add-on that does not support it yet',
			cors: 'the image ' + detail + ' is on another domain without CORS headers',
			context_lost: 'the browser dropped its graphics context',
		};
		console.log( 'Product configurator: using the image viewer instead of the canvas viewer: ' + ( messages[ reason ] || reason ) + '.' );
		if ( 'webgl' === reason ) {
			wp.hooks.doAction( 'PC.fe.viewer.webgl.unavailable', viewer, detail || null );
		}
		/**
		 * The canvas viewer was not used, or gave up.
		 *
		 * @param {String} reason pixi_missing | webgl | dom_item_view | cors | context_lost
		 * @param {*}      detail
		 * @param {Backbone.View|null} viewer The canvas viewer, when it had started.
		 */
		wp.hooks.doAction( 'PC.fe.viewer.canvas.fallback', reason, detail, viewer );
	}
} );

// Fetch Pixi in the background on canvas products (see load_pixi()).
PC.fe.views.viewer_canvas.preload_pixi();

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
		this.release();
	},
	/**
	 * Count this image off the viewer's tally of images being loaded.
	 *
	 * The layer renders on every `change` of the angles collection - twice per
	 * angle switch - but the browser reports one load for the src it ends up
	 * with. So it is counted once while it loads, and counted off once: see
	 * viewer_layer.release(). Counting it per render left a count behind on
	 * every angle switch, and the viewer kept `is-loading-image` for good.
	 */
	release: function() {
		if ( ! this.counted ) return;
		this.counted = false;

		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},
	/**
	 * Release a load that will never complete, like viewer_layer.remove().
	 */
	remove: function() {
		if ( this.counted && this.parent ) {
			this.counted = false;
			this.parent.imagesLoading --;
			if ( 0 >= this.parent.imagesLoading ) {
				this.parent.imagesLoading = 0;
				this.parent.$el.removeClass( 'is-loading-image' );
			}
		}
		return Backbone.View.prototype.remove.apply( this, arguments );
	},
	render: function() {
		var img = this.model.get_image();
		var width = PC.fe.modal.$el.outerWidth();
		if ( width && PC.fe.config.mobile_image_breakpoint && width < PC.fe.config.mobile_image_breakpoint && this.model.get_image( 'image', 'url_mobile' ) ) {
			img = this.model.get_image( 'image', 'url_mobile' );
		}
		if ( width && PC.fe.config.large_image_breakpoint && width >= PC.fe.config.large_image_breakpoint && this.model.get_image( 'image', 'url_large' ) ) {
			img = this.model.get_image( 'image', 'url_large' );
		}
		// Default to a transparent image
		if ( ! img ) img = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

		wp.hooks.doAction( 'PC.fe.viewer.static_layer.render', this );

		var classes = [ 'active', 'static' ];
		
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
		// Only a new src means a new load. Setting the one it already has would
		// wait for a load event that may never come.
		var layer = PC.fe.layers.get( this.model.get( 'layerId' ) );
		var new_src = img && img !== this.el.getAttribute( 'src' );
		if ( new_src ) {
			this.$el.addClass( 'loading' );
			// Masked layers get their src once the mask is ready (layer-masks.js).
			PC.fe.layer_masks.set_src( this, layer, img );
			// Already counted if the previous src is still loading: the browser
			// drops that request and reports the new one only.
			if ( ! this.counted ) {
				this.counted = true;
				this.parent.imagesLoading ++;
			}
		} else if ( img && PC.fe.layer_masks.mask_changed( this, layer ) ) {
			// The same file under another mask (another view): only the mask
			// changes, and no load is counted.
			PC.fe.layer_masks.set_src( this, layer, img, true );
		}
		if ( new_src ) {
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
		// No image on this view: the choice may fill its layer's mask with its colour
		// (choice-color.js). capture() draws the fill from `color_fill`.
		this.color_fill = img ? null : PC.fe.choice_color.fill( this.model );
		if ( this.color_fill ) img = PC.fe.choice_color.svg_url( this.color_fill );
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
				// Only a counted image may decrement the counter again - see img_loaded().
				this.counted = true;
				this.parent.$el.addClass('is-loading-image');
				this.$el.addClass( 'loading' );
				// Masked layers get their src once the mask is ready (layer-masks.js).
				PC.fe.layer_masks.set_src( this, this.layer, img );
			} 
			this.$el.addClass( 'active' );
		} else {
			if ( ! this.is_loaded ) {
				this.$el.addClass( 'loading' );
				if ( 'lazy' == PC.fe.config.image_loading_mode && ! force ) {
					PC.fe.layer_masks.set_src( this, this.layer, this.empty_img );
				} else {
					PC.fe.layer_masks.set_src( this, this.layer, img );
				}
			}
			this.$el.removeClass( 'active' );
		}

		this.$el.data( 'dimensions', this.color_fill ? { width: this.color_fill.width, height: this.color_fill.height } : this.model.get_image( 'image', 'dimensions' ) );
		
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
		// Whatever the outcome, anything waiting on this image now has its answer.
		this.settle();
		// An active choice with nothing to show at this angle is still handed a
		// src - the transparent placeholder - and this is the only load it will
		// ever report. It stays "not loaded", so a later angle gets it its real
		// image, but it does have to be counted off: it was counted when the
		// placeholder was set, and the viewer would otherwise be loading for good.
		if (this.empty_img == this.$el.prop('src')) return this.release();
		this.is_loaded = true;

		if ( 'load' == e.type ) wp.hooks.doAction( 'PC.fe.viewer.layer.preload.complete', this );

		this.release();
	},
	/**
	 * Count this image off the viewer's tally of images being loaded.
	 *
	 * Only images that were counted when their src was set may count down again.
	 * An inactive image also gets a src, but was never added to imagesLoading:
	 * decrementing for it drove the counter below zero, so it never came back to
	 * 0 and the viewer kept its `is-loading-image` class.
	 */
	release: function() {
		if ( ! this.counted ) return;
		this.counted = false;

		this.parent.imagesLoading --;
		if( this.parent.imagesLoading == 0 ) {
			this.parent.$el.removeClass('is-loading-image');
			wp.hooks.doAction( 'PC.fe.viewer.layers.preload.complete', this );
		}
	},
	/**
	 * Release a load that will never complete.
	 *
	 * Images are created and destroyed as the selection changes when the viewer
	 * only renders what it shows, so one can be removed while still loading.
	 */
	remove: function() {
		this.is_removed = true;
		// An image removed before it loaded is never going to appear: release
		// anything that was waiting for it, or the wait only ends on its timeout.
		this.settle();
		if ( this.counted && this.parent ) {
			this.counted = false;
			this.parent.imagesLoading --;
			if ( 0 >= this.parent.imagesLoading ) {
				this.parent.imagesLoading = 0;
				this.parent.$el.removeClass( 'is-loading-image' );
			}
		}
		return Backbone.View.prototype.remove.apply( this, arguments );
	},
	/**
	 * Call back once this image has finished loading - or once it is settled that
	 * it never will (it failed, or it was removed while still on its way).
	 *
	 * This is how the image being replaced knows when it may leave the screen;
	 * see viewer_layer_pool.wait_for().
	 *
	 * @param {Function} callback Receives this view.
	 */
	on_settled: function( callback ) {
		if ( this.is_loaded || this.is_removed ) return callback( this );
		this.settle_callbacks = this.settle_callbacks || [];
		this.settle_callbacks.push( callback );
	},

	settle: function() {
		if ( ! this.settle_callbacks ) return;
		var callbacks = this.settle_callbacks;
		this.settle_callbacks = null;
		_.each( callbacks, function( callback ) {
			callback( this );
		}, this );
	},

	/**
	 * Keep showing this image after its choice has been deselected.
	 *
	 * The view stops following its model - the model is inactive now, and
	 * rendering that would blank the image, which is the very thing the caller is
	 * holding it for - and it is put back in the state it was in when it was the
	 * selected choice.
	 *
	 * That last part is not belt and braces: a model's own listeners run before
	 * the ones its collection proxies, so this view has already reacted to the
	 * deselection and dropped its `active` class by the time the pool gets to
	 * call this. Nothing has been painted in between - it is all one turn - so
	 * putting the class back leaves no trace, and the image is never taken off
	 * the screen. It keeps the picture it has until remove() is called.
	 */
	retire: function() {
		this.is_retired = true;
		this.stopListening();
		// It is on its way out, so it is no longer a landmark for insert_image():
		// where it sits is decided by the image that replaces it.
		this.$el.removeAttr( 'data-mkl-sorted' );
		this.$el.removeClass( 'loading' ).addClass( 'active retired' );
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
	/**
	 * Keep this HTML on screen until the image it belongs with leaves.
	 * See viewer_layer.retire().
	 */
	retire: function() {
		this.is_retired = true;
		this.stopListening();
		this.$el.removeAttr( 'data-mkl-sorted' );
		this.$el.addClass( 'active retired' ).show();
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

/**
	PC.fe.views.viewer_layer_pool
	-> The images of ONE layer in the viewer.

	The viewer's default is an <img> per choice, shown and hidden with a class. On
	a large configuration that means thousands of images in the page to show a
	couple of hundred, and every one of them re-renders when the angle changes.

	This keeps only the images the layer actually shows - one for a simple layer,
	one per selection for a multiple choice layer, none while the layer is hidden
	or has nothing selected - and creates them as the selection changes.

	It owns no element of its own: the images stay direct children of
	.mkl_pc_layers, exactly where they are today, so stylesheets written against
	them keep working. Its own `el` is never inserted anywhere.
*/
PC.fe.views.viewer_layer_pool = Backbone.View.extend({
	initialize: function( options ) {
		this.options = options || {};
		this.parent = options.parent;
		this.layer = options.model;
		this.choices = PC.fe.getLayerContent( this.layer.id );
		this.views = {};
		this.html_views = {};
		this.preloaded = {};
		// Images that are no longer selected but are still on screen, waiting for
		// what replaces them - see hold() and sweep().
		this.held = [];
		this.incoming = [];
		this.waits = [];
		this.sweep_scheduled = false;

		if ( ! this.choices ) return this;

		this.listenTo( this.choices, 'change:active', this.sync );
		this.listenTo( this.choices, 'change:cshow', this.sync );
		this.listenTo( this.choices, 'preload-image', this.preload );
		// Any layer's visibility can hide this one through a group ancestor, so
		// this listens to the collection rather than to this layer alone.
		this.listenTo( PC.fe.layers, 'change:cshow', this.sync );

		this.sync();

		return this;
	},

	/**
	 * The choices that need an image in the viewer right now.
	 *
	 * @return {Array} choice models
	 */
	get_visible_choices: function() {
		var state = PC.fe.viewer_state;
		return _.filter( state.shown_choices( this.layer ), function( choice ) {
			return state.has_drawable( choice );
		} );
	},

	/**
	 * Bring the images in line with what the layer currently shows.
	 *
	 * Adding happens here and now; removing is decided at the end of the turn, by
	 * sweep(). A choice change reaches this in two steps - the old choice goes
	 * inactive, then the new one goes active - and acting on the first would empty
	 * the layer before the second says what to put in its place.
	 */
	sync: function() {
		var wanted = {};
		_.each( this.get_visible_choices(), function( choice ) {
			wanted[ choice.id ] = choice;
		} );

		_.each( _.keys( this.views ), function( id ) {
			if ( wanted[ id ] ) return;
			this.hold( id );
		}, this );

		_.each( wanted, function( choice, id ) {
			if ( this.views[ id ] ) return;
			this.incoming.push( this.add_view( choice ) );
		}, this );

		this.schedule_sweep();
	},

	/**
	 * Take an image out of the layer, but leave it on the screen.
	 *
	 * It has to stop following its model right now, in this pass: the choice is
	 * already inactive, and the view's own listener has already run and taken the
	 * image out of sight - retire() puts it back. From here on it is a picture
	 * with nothing behind it, held by sweep() until its replacement takes over.
	 *
	 * @param {String|Number} id Choice id.
	 */
	hold: function( id ) {
		var view = this.views[ id ];
		var html_view = this.html_views[ id ];
		delete this.views[ id ];
		delete this.html_views[ id ];
		if ( ! view ) {
			if ( html_view ) html_view.remove();
			return;
		}
		if ( this.parent.layer_views ) delete this.parent.layer_views[ this.parent.view_key( view.model ) ];

		/**
		 * Whether an image stays up until the one replacing it has loaded.
		 *
		 * @param {Boolean} hold
		 * @param {Backbone.View} view
		 */
		var keep = wp.hooks.applyFilters( 'PC.fe.viewer.hold_previous_image', true, view, this );

		// Nothing to hold on to: a view that is not one of ours to freeze, or an
		// image that never made it to the screen in the first place.
		if ( ! keep || ! view.is_loaded || ! view.retire ) {
			view.remove();
			if ( html_view ) html_view.remove();
			return;
		}

		view.retire();
		this.held.push( view );
		if ( html_view && html_view.retire ) {
			html_view.retire();
			this.held.push( html_view );
		} else if ( html_view ) {
			html_view.remove();
		}
	},

	/**
	 * Decide what leaves the screen, once the whole selection change has been
	 * seen. Runs before the browser paints, so a layer that is simply going away
	 * does not linger for a frame.
	 */
	schedule_sweep: function() {
		if ( this.sweep_scheduled ) return;
		this.sweep_scheduled = true;
		var that = this;
		var run = function() { that.sweep(); };
		if ( 'undefined' !== typeof Promise ) Promise.resolve().then( run );
		else _.defer( run );
	},

	/**
	 * Send the images that were held on their way.
	 *
	 * They leave at once if nothing is on its way in - a choice deselected, a
	 * layer hidden by conditional logic. Otherwise they stay up until the images
	 * added in the same change have loaded.
	 */
	sweep: function() {
		this.sweep_scheduled = false;

		var that = this;
		var incoming = _.filter( this.incoming, function( view ) {
			// Still ours, and still not on screen: those are the ones worth waiting
			// for. One that loaded within the turn is already showing.
			return view && ! view.is_loaded && that.views[ view.model.id ] === view;
		} );
		this.incoming = [];

		var held = this.held;
		this.held = [];
		if ( ! held.length ) return;

		if ( ! incoming.length ) return this.drop( held );

		this.wait_for( incoming, held );
	},

	/**
	 * Hold `held` on screen until `incoming` has loaded.
	 *
	 * The images being loaded are transparent until they are ready - every theme
	 * hides `img.loading` - so what the customer sees for the length of the
	 * request is the picture they had, rather than the background.
	 *
	 * @param {Array} incoming Views still loading.
	 * @param {Array} held     Views to remove once they have.
	 */
	wait_for: function( incoming, held ) {
		var that = this;
		var wait = { held: held, pending: incoming.length, done: false, timer: null };
		this.waits.push( wait );

		// Underneath the images that replace them, so the new picture fades in over
		// the old one instead of over the background.
		_.each( held, function( view ) {
			incoming[ 0 ].$el.before( view.$el );
		} );

		// However the loading turns out, these images do leave: a request that
		// never completes must not strand a deselected choice on screen.
		wait.timer = setTimeout( function() {
			that.end_wait( wait );
		}, wp.hooks.applyFilters( 'PC.fe.viewer.swap_timeout', 5000, this ) );

		var settled = function( view ) {
			if ( 0 < --wait.pending ) return;
			// Let the new image finish fading in before taking the old one away.
			setTimeout( function() { that.end_wait( wait ); }, that.fade_duration( view ) );
		};

		_.each( incoming, function( view ) {
			if ( view.on_settled ) return view.on_settled( settled );
			settled( view );
		} );
	},

	end_wait: function( wait ) {
		if ( wait.done ) return;
		wait.done = true;
		if ( wait.timer ) clearTimeout( wait.timer );
		this.waits = _.without( this.waits, wait );
		this.drop( wait.held );
	},

	drop: function( views ) {
		_.each( views, function( view ) {
			view.remove();
		} );
	},

	/**
	 * How long the stylesheet takes to fade an image in, in milliseconds.
	 *
	 * Read off the element rather than assumed: every theme fades the viewer's
	 * images, but how long for is the theme's - or the store's - business.
	 *
	 * @param {Backbone.View} view
	 * @return {Number}
	 */
	fade_duration: function( view ) {
		if ( ! view || ! view.el || ! window.getComputedStyle ) return 0;
		var declared = window.getComputedStyle( view.el ).transitionDuration || '';
		var longest = 0;
		_.each( declared.split( ',' ), function( part ) {
			part = part.replace( /\s/g, '' );
			var value = parseFloat( part );
			if ( isNaN( value ) ) return;
			longest = Math.max( longest, -1 === part.indexOf( 'ms' ) ? value * 1000 : value );
		} );
		return longest;
	},

	add_view: function( choice ) {
		var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, choice, this.parent );
		var view = new View( { model: choice, parent: this.parent } );

		this.views[ choice.id ] = view;
		// Keep the viewer's indexes up to date so capture() can find the drawable.
		this.parent.layers[ choice.id ] = view;
		this.parent.layer_views[ this.parent.view_key( choice ) ] = view;

		this.parent.insert_image( view.$el, this.parent.sort_key( choice ) );
		wp.hooks.doAction( 'PC.fe.viewer.item.added', view, this.parent );

		if ( choice.get( 'custom_html' ) ) {
			var html_view = new PC.fe.views.viewer_layer_html( { model: choice, layer: view, parent: this.parent } );
			this.html_views[ choice.id ] = html_view;
			this.parent.insert_image( html_view.$el, this.parent.sort_key( choice, 1 ) );
			wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_view, this.parent );
		}

		return view;
	},

	remove_view: function( id ) {
		if ( this.views[ id ] ) {
			var key = this.parent.view_key( this.views[ id ].model );
			this.views[ id ].remove();
			delete this.views[ id ];
			if ( this.parent.layer_views ) delete this.parent.layer_views[ key ];
		}
		if ( this.html_views[ id ] ) {
			this.html_views[ id ].remove();
			delete this.html_views[ id ];
		}
	},

	/**
	 * Warm the browser cache for a choice the customer is hovering.
	 *
	 * There is no waiting <img> to point at an unselected choice any more, so the
	 * request is made off-DOM: same effect on the cache, nothing added to the page.
	 *
	 * @param {Backbone.Model} choice
	 */
	preload: function( choice ) {
		if ( ! choice || ! choice.get_image ) return;
		if ( this.views[ choice.id ] ) return;

		var url = choice.get_image();
		if ( ! url || this.preloaded[ url ] ) return;

		this.preloaded[ url ] = true;
		var img = new Image();
		img.src = url;
	},

	remove: function() {
		_.each( this.waits.slice(), function( wait ) {
			this.end_wait( wait );
		}, this );
		this.drop( this.held );
		this.held = [];
		this.incoming = [];
		_.each( _.keys( this.views ), function( id ) {
			this.remove_view( id );
		}, this );
		return Backbone.View.prototype.remove.apply( this, arguments );
	}
});

/*
	PC.fe.viewer_state
	-> What the 2D picture shows, decided from the models alone.

	One rule for every viewer: the <img> stack's image pools, capture(), and the
	canvas viewer. It reads choice `active` and `cshow` (through conditional
	logic when it is installed), never the markup a particular viewer emits.
*/

PC.fe.viewer_state = {

	/**
	 * Whether a layer is hidden by conditional logic, itself or through a group
	 * ancestor.
	 *
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	is_layer_hidden: function( layer ) {
		if ( false === layer.get( 'cshow' ) ) return true;
		if ( PC.conditionalLogic && PC.conditionalLogic.parent_is_hidden ) {
			return !! PC.conditionalLogic.parent_is_hidden( layer );
		}
		return false;
	},

	/**
	 * Whether a choice is hidden by conditional logic.
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	is_choice_hidden: function( choice ) {
		if ( PC.conditionalLogic && PC.conditionalLogic.item_is_hidden ) {
			return !! PC.conditionalLogic.item_is_hidden( choice );
		}
		// Conditional logic is not installed: fall back to the plain flags.
		if ( false === choice.get( 'cshow' ) ) return true;
		var layer = PC.fe.layers.get( choice.get( 'layerId' ) );
		return !! ( layer && false === layer.get( 'cshow' ) );
	},

	/**
	 * The choices of one layer that are part of the picture: every active one
	 * (multiple-choice layers can have several), minus groups and anything
	 * conditional logic hides. A static (`not_a_choice`) layer always shows its
	 * one choice, unless the layer itself is hidden.
	 *
	 * Whether a choice has anything to draw is not decided here: callers that
	 * need it ask has_drawable().
	 *
	 * @param {Backbone.Model} layer
	 * @return {Array} choice models, in layer order
	 */
	shown_choices: function( layer ) {
		var choices = PC.fe.getLayerContent( layer.id );
		if ( ! choices ) return [];
		if ( this.is_layer_hidden( layer ) ) return [];

		var shown;
		if ( layer.get( 'not_a_choice' ) ) {
			var first = choices.first();
			shown = first ? [ first ] : [];
		} else {
			var that = this;
			shown = choices.filter( function( choice ) {
				if ( ! choice.get( 'active' ) ) return false;
				if ( choice.get( 'is_group' ) ) return false;
				return ! that.is_choice_hidden( choice );
			} );
		}

		/**
		 * Filter PC.fe.viewer.shown_choices: the choices of a layer drawn in the picture.
		 *
		 * For choices that draw without being selected, such as Form builder's upload fields
		 * shown in the preview (docs/image-overlay-spec.md). Added choices are drawn by
		 * their canvas item; conditional logic still hides them.
		 *
		 * @param {Array}               shown   choice models
		 * @param {Backbone.Model}      layer
		 * @param {Backbone.Collection} choices the layer's choices
		 */
		var filtered = wp.hooks.applyFilters( 'PC.fe.viewer.shown_choices', shown, layer, choices );
		if ( filtered === shown || ! filtered || ! filtered.length ) return filtered || [];
		var hide = this;
		return filtered.filter( function( choice, index ) {
			// Once each, and never what conditional logic hides.
			return filtered.indexOf( choice ) === index && ( -1 !== shown.indexOf( choice ) || ! hide.is_choice_hidden( choice ) );
		} );
	},

	/**
	 * Whether a choice gives a viewer something to draw: an image, its colour
	 * (docs/solid-colour-choices-spec.md), or a layer type that renders itself
	 * (the text overlay draws a canvas with no image).
	 *
	 * @param {Backbone.Model} choice
	 * @return {Boolean}
	 */
	has_drawable: function( choice ) {
		if ( choice.has_image() ) return true;
		// A choice drawing its colour on some view (choice-color.js).
		if ( PC.fe.choice_color && PC.fe.choice_color.has_fill( choice ) ) return true;
		return !! wp.hooks.applyFilters( 'PC.fe.viewer.item.render.empty.images', false, choice );
	},

	/**
	 * Where a layer sits in a view's picture, bottom first: the view's own order when it has
	 * one (`image_order_by_angle`, a sparse map of angle id to order, set by the Image order
	 * screen; canvas viewer only), else the configurator's `image_order`.
	 *
	 * @param {Backbone.Model} layer
	 * @param {String|Number}  [angle_id]
	 * @return {Number}
	 */
	image_order: function( layer, angle_id ) {
		var own = PC.fe.viewer_state.view_image_order( layer, angle_id );
		if ( null !== own ) return own;
		return parseInt( layer.get( 'image_order' ) ) || 0;
	},

	/**
	 * Views have their own orders only in the canvas viewer: it keeps one stack per view.
	 * The <img> stack keeps the configurator's order (decision, Marc 2026-11-10).
	 */
	has_view_orders: function() {
		var Canvas = PC.fe.views && PC.fe.views.viewer_canvas;
		return !! ( Canvas && Canvas.renderer && 'canvas' === Canvas.renderer() && ! Canvas.disabled );
	},

	/**
	 * The view's own order for a layer, or null.
	 */
	view_image_order: function( layer, angle_id ) {
		if ( undefined === angle_id || null === angle_id ) return null;
		if ( ! PC.fe.viewer_state.has_view_orders() ) return null;
		var map = layer.get( 'image_order_by_angle' );
		if ( ! map || 'object' !== typeof map || ! Object.prototype.hasOwnProperty.call( map, angle_id ) ) return null;
		var value = parseFloat( map[ angle_id ] );
		return isNaN( value ) ? null : value;
	},

	/**
	 * The layers, bottom of the picture first.
	 *
	 * @param {String|Number} [angle_id] The view: its own order when it has one.
	 * @return {Array} layer models
	 */
	layers_in_image_order: function( angle_id ) {
		var state = PC.fe.viewer_state;
		return PC.fe.layers.sortBy( function( layer ) {
			return state.image_order( layer, angle_id );
		} );
	},

	/**
	 * Every choice in the current picture, bottom layer first.
	 *
	 * @param {String|Number} [angle_id] The view: its own order when it has one.
	 * @return {Array} choice models
	 */
	picture: function( angle_id ) {
		var models = [];
		_.each( this.layers_in_image_order( angle_id ), function( layer ) {
			models.push.apply( models, this.shown_choices( layer ) );
		}, this );
		return models;
	}
};

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
			// Choice ids are only unique WITHIN a layer, so this.layers (keyed by
			// choice id) silently overwrites views across layers. Keep a correctly
			// keyed index for anything that needs to find a view reliably.
			this.layer_views = {};
			this.pools = {};
			this.order_index = {};

			this.add_loader();
			this.add_layers();
	

		} else {
			console.log('no content to show.');
		}
		
		wp.hooks.doAction( 'PC.fe.viewer.render', this );

		return this.$el; 

	},

	add_loader: function() {
		this.$loader = $( '<div class="images-loading" />' );
		this.$layers.append( this.$loader );
	},

	/**
	 * Whether the viewer should render only the images it shows.
	 *
	 * Off unless the store turns it on: it removes the <img> of every unselected
	 * choice, and a stylesheet or customisation may count on those being in the
	 * page (`img:not(.active)`, sibling combinators, counting children). On for
	 * new stores, off for existing ones.
	 *
	 * Force it either way with:
	 *   wp.hooks.addFilter( 'PC.fe.viewer.active_images_only', 'my-theme', function() { return true; } );
	 *
	 * @return {Boolean}
	 */
	active_images_only: function() {
		return !! wp.hooks.applyFilters( 'PC.fe.viewer.active_images_only', !! PC.fe.config.viewer_active_images_only, this );
	},

	/**
	 * Whether this layer's images are managed as a pool.
	 *
	 * Only layer types that show what is selected. Anything else draws itself and
	 * decides its own visibility - a text overlay renders a canvas per choice -
	 * so those keep an element per choice, as before.
	 *
	 * @param {Backbone.Model} layer
	 * @return {Boolean}
	 */
	layer_is_pooled: function( layer ) {
		var type = layer.get( 'type' ) || 'simple';
		var pooled = -1 !== [ 'simple', 'multiple' ].indexOf( type );
		return !! wp.hooks.applyFilters( 'PC.fe.viewer.layer_is_pooled', pooled, layer, this );
	},

	add_layers: function() {
		var orders = PC.fe.layers.pluck( 'image_order' );
		if ( orders.length && _.max( orders ) ) {
			PC.fe.layers.orderBy = 'image_order';
			PC.fe.layers.sort();
		}

		// Remember where each layer's images belong in the stack. An image can be
		// created long after this first pass - when its choice is selected, or when
		// conditional logic reveals its layer - and by then the collection may have
		// been re-sorted by another view (the layers list orders it by `order`), so
		// position is recorded here rather than looked up later.
		this.order_index = {};
		PC.fe.layers.each( function( layer, index ) {
			this.order_index[ layer.id ] = index;
		}, this );

		PC.fe.layers.each( this.add_choices, this );
	}, 

	/**
	 * Where an element belongs among the viewer's layers: the layer's position in
	 * image order, then the choice's position within the layer, then 0 for the
	 * image itself and 1 for the custom HTML that follows it.
	 *
	 * @param {Backbone.Model} choice
	 * @param {Number} [tail]
	 * @return {Array}
	 */
	sort_key: function( choice, tail ) {
		var layer_id = choice.get( 'layerId' );
		var content = PC.fe.getLayerContent( layer_id );
		var layer_position = ( this.order_index && 'undefined' !== typeof this.order_index[ layer_id ] ) ? this.order_index[ layer_id ] : PC.fe.layers.length;
		return [ layer_position, content ? content.indexOf( choice ) : 0, tail || 0 ];
	},

	compare_sort: function( a, b ) {
		for ( var i = 0; i < Math.max( a.length, b.length ); i++ ) {
			var x = a[ i ] || 0;
			var y = b[ i ] || 0;
			if ( x !== y ) return x < y ? -1 : 1;
		}
		return 0;
	},

	/**
	 * Put an element where it belongs in the stack, rather than at the end.
	 *
	 * The first pass runs in image order, so appending would do - but an image can
	 * be created much later, when its choice is selected or when conditional logic
	 * reveals its layer, and it still has to sit at the right depth.
	 *
	 * @param {jQuery} $el
	 * @param {Array} sort From sort_key().
	 */
	insert_image: function( $el, sort ) {
		$el.data( 'mkl_sort', sort ).attr( 'data-mkl-sorted', '1' );

		var $before = null;
		var that = this;
		this.$layers.children( '[data-mkl-sorted]' ).each( function() {
			var other = $( this ).data( 'mkl_sort' );
			if ( ! other ) return;
			if ( 0 < that.compare_sort( other, sort ) ) {
				$before = $( this );
				return false;
			}
		} );

		if ( $before ) {
			$before.before( $el );
		} else if ( this.$loader && this.$loader.length ) {
			this.$loader.before( $el );
		} else {
			this.$layers.append( $el );
		}
	},

	add_choices: function( model ) {
		var choices = PC.fe.getLayerContent( model.id );
		if ( ! choices ) {
			return;
		}
		if ( model.get( 'not_a_choice') ) {
			var choice = choices.first();
			var layer = new PC.fe.views.viewer_static_layer( { model: choice, parent: this } );
			// Keep the view so capture() can ask it for its drawable, like any other layer.
			if ( choice ) {
				this.layers[ choice.id ] = layer;
				this.layer_views[ this.view_key( choice ) ] = layer;
				this.insert_image( layer.$el, this.sort_key( choice ) );
			} else {
				this.$layers.append( layer.$el );
			}
			if ( choice.get( 'custom_html' ) ) {
				var content;
				try {
					content = $( choice.get( 'custom_html' ) );
				} catch( e ) {
					content = $( '<div class="mkl-custom-html--container" />' );
					content.html( choice.get( 'custom_html' ) )
				}
				this.insert_image( content, this.sort_key( choice, 1 ) );
			}
		} else if ( this.active_images_only() && this.layer_is_pooled( model ) ) {
			this.pools[ model.id ] = new PC.fe.views.viewer_layer_pool( { model: model, parent: this } );
		} else {
			choices.each( this.add_single_choice, this );
		}
	},

	add_single_choice: function( model ) {
		if ( PC.fe.viewer_state.has_drawable( model ) ) {
			var View = wp.hooks.applyFilters( 'PC.fe.viewer.item.view', PC.fe.views.viewer_layer, model, this );
			var layer = new View( { model: model, parent: this } );
			this.insert_image( layer.$el, this.sort_key( model ) );
		} else {
			layer = false;
		}

		wp.hooks.doAction( 'PC.fe.viewer.item.added', layer, this );
		if ( model.get( 'custom_html' ) ) {
			var html_layer = new PC.fe.views.viewer_layer_html( { model: model, layer: layer, parent: this } );
			this.insert_image( html_layer.$el, this.sort_key( model, 1 ) );
			wp.hooks.doAction( 'PC.fe.viewer.html_item.added', html_layer, this );
		}
		this.layers[ model.id ] = layer;
		this.layer_views[ this.view_key( model ) ] = layer;
	},

	/**
	 * Index key for a choice's layer view. Choice ids repeat across layers, so
	 * the layer id has to be part of the key.
	 */
	view_key: function( choice ) {
		return choice.get( 'layerId' ) + ':' + choice.id;
	},

	/**
	 * Whether a model is hidden by conditional logic.
	 *
	 * Kept for callers of the viewer; the rule lives in PC.fe.viewer_state.
	 */
	is_hidden_by_conditions: function( choice ) {
		return PC.fe.viewer_state.is_choice_hidden( choice );
	},

	/**
	 * The choice models that make up the current picture, bottom layer first.
	 *
	 * Mirrors what add_layers()/add_choices() put on screen, but derived purely
	 * from the models (PC.fe.viewer_state.picture()): layers in image_order,
	 * every ACTIVE choice of each (multiple-choice layers can have several),
	 * minus anything conditional logic has hidden. Static (`not_a_choice`)
	 * layers are always drawn, as viewer_static_layer does.
	 *
	 * @return {Array} choice models
	 */
	get_capture_models: function() {
		var models = PC.fe.viewer_state.picture();

		/**
		 * Filter the models composited into a captured image.
		 *
		 * @param {Array} models Choice models, bottom layer first.
		 * @param {Backbone.View} viewer
		 */
		return wp.hooks.applyFilters( 'PC.fe.viewer.capture.models', models, this );
	},

	/**
	 * The thing to draw for one choice: whatever the layer view that owns it
	 * offers, so implementations that are not a plain <img> (the text overlay
	 * renders a canvas) come through too.
	 *
	 * Returns:
	 *   HTMLImageElement | HTMLCanvasElement - draw this
	 *   'none'                               - nothing to draw, and that is fine
	 *   null                                 - cannot represent this layer
	 *
	 * @param {Backbone.Model} choice
	 * @return {HTMLElement|string|null}
	 */
	get_capture_source: function( choice ) {
		var view = this.layer_views ? this.layer_views[ this.view_key( choice ) ] : null;

		// A view may describe its own drawable (the contract's extension point).
		if ( view && 'function' === typeof view.get_capture_source ) {
			return view.get_capture_source();
		}

		if ( view && view.el ) {
			if ( 'IMG' === view.el.tagName ) {
				// Only usable once decoded; an empty placeholder means "nothing here".
				if ( ! view.el.getAttribute( 'src' ) || 0 === view.el.getAttribute( 'src' ).indexOf( 'data:image/gif' ) ) return 'none';
				// A colour fill is drawn from its colour, not from its SVG (choice-color.js).
				if ( view.color_fill && PC.fe.choice_color.is_fill_url( view.el.getAttribute( 'src' ) ) ) {
					return view.el.complete ? PC.fe.choice_color.fill_canvas( view.color_fill ) : null;
				}
				return view.el.complete && view.el.naturalWidth ? view.el : null;
			}
			var canvas = view.el.querySelector ? view.el.querySelector( 'canvas' ) : null;
			if ( canvas ) return canvas;
		}

		// No view (not rendered, or the choice carries no image or colour at all).
		if ( ! choice.has_image() && ! ( PC.fe.choice_color && PC.fe.choice_color.has_fill( choice ) ) ) return 'none';

		return null;
	},

	/**
	 * The loaded mask the view of a choice cut its image with, if any: the CSS
	 * mask is not part of what drawImage() reads. See layer-masks.js.
	 *
	 * @param {Backbone.Model} choice
	 * @return {HTMLImageElement|null}
	 */
	get_capture_mask: function( choice ) {
		var view = this.layer_views ? this.layer_views[ this.view_key( choice ) ] : null;
		return view && view.mask_image ? view.mask_image : null;
	},

	/**
	 * Whether a layer is hidden by conditional logic, itself or through a group.
	 *
	 * Kept for callers of the viewer; the rule lives in PC.fe.viewer_state.
	 */
	is_hidden_by_conditions_layer: function( layer ) {
		return PC.fe.viewer_state.is_layer_hidden( layer );
	},

	/**
	 * Capture the current configuration to a PNG blob (see the viewer contract
	 * in configurator.js).
	 *
	 * WHAT to draw comes from the models (active choices, minus anything
	 * conditional logic hid); HOW to draw each one comes from the layer view that
	 * owns it, so a text overlay's canvas composites alongside plain images. No
	 * CSS class is consulted, so this does not depend on the markup a particular
	 * viewer happens to emit.
	 *
	 * Resolves null - never a partial picture - when a visible layer cannot be
	 * represented or the canvas is tainted by a cross-origin image, so callers
	 * fall back knowingly instead of shipping a wrong image.
	 *
	 * @param {Object} [options] { width, height, maxDimension }
	 * @return {Promise<Blob|null>}
	 */
	capture: function( options ) {
		options = options || {};
		var that = this;
		var models = this.get_capture_models();
		if ( ! models.length ) return Promise.resolve( null );

		var max_dimension = options.maxDimension || wp.hooks.applyFilters( 'PC.fe.pdf.max_dimension', 1200 );

		var sources = [];
		for ( var i = 0; i < models.length; i++ ) {
			var source = that.get_capture_source( models[ i ] );
			if ( null === source ) {
				// A layer we can see but cannot draw: refuse rather than drop it.
				console.log(
					'Product configurator: cannot capture the layer "' +
					( models[ i ].get( 'name' ) || models[ i ].id ) +
					'", falling back to another capture method.'
				);
				return Promise.resolve( null );
			}
			if ( 'none' !== source ) sources.push( { el: source, mask: that.get_capture_mask( models[ i ] ) } );
		}

		if ( ! sources.length ) return Promise.resolve( null );

		var width = 0, height = 0;
		_.each( sources, function( source ) {
			var el = source.el;
			width = Math.max( width, el.naturalWidth || el.width || 0 );
			height = Math.max( height, el.naturalHeight || el.height || 0 );
		} );
		if ( ! width || ! height ) return Promise.resolve( null );

		if ( options.width && options.height ) {
			width = options.width;
			height = options.height;
		} else if ( width > max_dimension || height > max_dimension ) {
			var ratio = height / width;
			if ( height > width ) {
				height = max_dimension;
				width = height / ratio;
			} else {
				width = max_dimension;
				height = width * ratio;
			}
		}

		var canvas = document.createElement( 'canvas' );
		canvas.width = Math.round( width );
		canvas.height = Math.round( height );
		var ctx = canvas.getContext( '2d' );

		try {
			_.each( sources, function( source ) {
				// A CSS mask is not part of the image: cut it here (layer-masks.js).
				if ( source.mask ) {
					PC.fe.layer_masks.draw_masked( ctx, source.el, source.mask, canvas.width, canvas.height );
				} else {
					ctx.drawImage( source.el, 0, 0, canvas.width, canvas.height );
				}
			} );
		} catch ( err ) {
			console.log( 'Product configurator: could not compose the captured image.', err );
			return Promise.resolve( null );
		}

		/**
		 * Draw on top of the composited layers (watermark, background...).
		 *
		 * @param {CanvasRenderingContext2D} ctx
		 * @param {HTMLCanvasElement} canvas
		 * @param {Backbone.View} viewer
		 */
		wp.hooks.doAction( 'PC.fe.viewer.capture.canvas', ctx, canvas, this );

		return new Promise( function( resolve ) {
			try {
				canvas.toBlob( function( blob ) { resolve( blob || null ); }, 'image/png' );
			} catch ( err ) {
				// Tainted canvas: a layer image is on another domain that does not
				// send Access-Control-Allow-Origin.
				console.log( 'Product configurator: the captured canvas could not be exported (cross-origin image).', err );
				resolve( null );
			}
		} );
	}
});
} ) ( jQuery, PC._us || window._ );
