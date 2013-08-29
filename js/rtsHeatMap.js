
(function($) {

	$.fn.rtsHeatMapDefaults =  {

		mapBackgroundcolor : "white", // background color of map, the canvas' element color

		mapHeight : null, // If null, i'll use the parent DOM height if possible (otherwise, fallback 200px).
		mapWidth : null, // If null, i'll use the parent DOM width

		mapSegmentColor : "#89bc62", // You must provide me and RGB value (rgb(255,255,255)) and i'll use this (in HSL format) only OR the word random, then i'll pick one for you
		mapSegmentMinLightness : .15,
		mapSegmentMaxLightness : .85,
		mapSegmentRadius : 0,

		mapColumnSegmentDimensions : {width:15,height:15}, // Dimensions, in pixels. (10px height, 10px width)
		//mapColumnMaxSegmentCount : 7, // The number of segments rendered per column

		mapData : {}, // Data for the map (object array)

		mapComplete : null // Once all maps have been renedered, i'll call this
	};

	// http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb (modified for this plugin)
	function hexToRgb(hex) {
	    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
	    return result ? {r:parseInt(result[1], 16),g:parseInt(result[2], 16),b:parseInt(result[3], 16)} : null;
	}
	// http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
	function hslToRgb(h, s, l){
		var r, g, b;

		if(s == 0){
			r = g = b = l; // achromatic
		}else{
			function hue2rgb(p, q, t){
				if(t < 0) t += 1;
				if(t > 1) t -= 1;
				if(t < 1/6) return p + (q - p) * 6 * t;
				if(t < 1/2) return q;
				if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
				return p;
			}

			var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
			var p = 2 * l - q;
			r = hue2rgb(p, q, h + 1/3);
			g = hue2rgb(p, q, h);
			b = hue2rgb(p, q, h - 1/3);
		}

		return {r:r * 255, g:g * 255, b:b * 255};
	}
	function rgbToHsl(r, g, b){
		r /= 255, g /= 255, b /= 255;
		var max = Math.max(r, g, b), min = Math.min(r, g, b);
		var h, s, l = (max + min) / 2;

		if(max == min){
			h = s = 0; // achromatic
		}else{
			var d = max - min;
			s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
			switch(max){
				case r: h = (g - b) / d + (g < b ? 6 : 0); break;
				case g: h = (b - r) / d + 2; break;
				case b: h = (r - g) / d + 4; break;
			}
			h /= 6;
		}

		return {h:h, s:s, l:l};
	}
	function log(msg)  { console.log(msg); }
	Object.size = function(obj) { var size = 0, key; for (key in obj) { if (obj.hasOwnProperty(key)) size++; } return size; };
	String.prototype.format = function() { var args = arguments; return this.replace(/\{(\d+)\}/g, function(match, number) { return typeof args[number] != 'undefined' ? args[number] : match; }); };
	// Array.prototype.max = function() {  return Math.max.apply(null, this); };
	// Array.prototype.min = function() {  return Math.min.apply(null, this); };

	// Main Entry point for plugin
	var RTSHeatMap = function(element, options) {
		var $this = element;
		var obj = this;

		// I support the Data option!
		// http://learn.jquery.com/plugins/advanced-plugin-concepts/
		var settings = $.extend({},$.fn.rtsHeatMapDefaults,options);
		var opts = $.extend({},settings,$this.data());

		// Public methods
		this.set = function(name,value) { if(opts[name]) opts[name] = value; return this; };
		this.get = function(name) { return opts[name] || null; };

		// More useful methods
		this.setMapSegmentColor = function(color) {
			opts.mapSegmentColor = color;
			// Get the layers (segments) of this canvas object and change their colors ><
			var domObj = $this.find('canvas');
			var layers = domObj.getLayers();
			for(var key in layers) {
				var layer = layers[key];
				domObj.setLayer(layer,{
					fillStyle : getFillStyle(layer.data.dataValue) // hurp...
				})
			}
			domObj.drawLayers(); // once all layers have their colors, draw them
			//return this; // doing this only means you can chain my methods, and not jQuery object ones... do not want.
		}

		this.setMapBackgroundColor = function(color) {
			opts.mapBackgroundcolor = color;
			var domObj = $this.find('canvas');
			domObj.css({'background-color' : opts.mapBackgroundcolor});
			//return this;
		}

		// This method not only sets the size of the segments, but repositions them to fit the new size (just the segments, not the canvas object)
		this.setMapSegmentSize = function(w,h) {

			opts.mapColumnSegmentDimensions.width = w;
			opts.mapColumnSegmentDimensions.height = h;

			var domObj = $this.find('canvas');
			var layers = domObj.getLayers();
			for(var key in layers) {
				var layer = layers[key];
				domObj.setLayer(layer,{
					x: getX(key),
					y: getY(key),
					width: opts.mapColumnSegmentDimensions.width,
					height: opts.mapColumnSegmentDimensions.height,
				})
			}
			domObj.drawLayers(); // once all layers have their colors, draw them
		}

		// Private
		var createCanvasObject = function(domObj) {
			// objID should be the parent's domObj. I'll use id to unique this guy, or a name
			var objName = "rtsMap";
			if(domObj.attr('id') != "") objName = domObj.attr('id')+"rtsHeatMap";

			opts.mapHeight = (opts.mapHeight) ? opts.mapHeight : $this.height();
			opts.mapWidth = (opts.mapWidth) ? opts.mapWidth : $this.width();

			var cObj = $('<canvas/>')
				.attr({
					'id' :objName,
					'height' : opts.mapHeight,
					'width' : opts.mapWidth
				})
				.css({
					'background-color' : opts.mapBackgroundcolor
				})
				.text('Your browser does not support canvas. Please upgrade your browser');

			domObj.append(cObj); // write the new canvas to the parent.
			return cObj;
		}

		var getFillStyle = function(val) {
			// Determine Fill Style
			fillStyle = hexToRgb(opts.mapSegmentColor); // This will either be null (it wasn't hex) or an string rgb value
			if(!fillStyle) fillStyle = opts.mapSegmentColor; // returns {r:0,g:0,b:0} object

			var hsl = rgbToHsl(fillStyle.r,fillStyle.g,fillStyle.b); // Canvas does accept hsl values. the L
			hsl.l = Math.abs( opts.mapSegmentMinLightness + (val * ratio) - 1 ); // Flips dark/light so its lower the number, lighter the color.

			var rgb = hslToRgb(hsl.h,hsl.s,hsl.l);
			fillStyle = 'rgb({0},{1},{2})'.format(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));

			return fillStyle;
		}

		var getX = function(increment) {
			// Determine X position (column)
			var xm = (increment/((opts.mapHeight / opts.mapColumnSegmentDimensions.height)|0))|0;
			var x = xm * opts.mapColumnSegmentDimensions.width; // First value
			return x;
		}

		var getY = function(increment) {
			// Determine Y position (row)
			var ym = (increment % ((opts.mapHeight / opts.mapColumnSegmentDimensions.height)|0) ); // Y pos multiplier
			var y = ym * opts.mapColumnSegmentDimensions.height;
			return y;
		}

		// My random color do-hicky
		// http://www.paulirish.com/2009/random-hex-color-code-snippets/
		if(opts.mapSegmentColor == 'random')
			opts.mapSegmentColor = '#'+('000000' + Math.floor(Math.random()*0xFFFFFF<<0).toString(16)).slice(-6);
		if(opts.mapBackgroundcolor == 'random')
			opts.mapBackgroundcolor = '#'+('000000' + Math.floor(Math.random()*0xFFFFFF<<0).toString(16)).slice(-6);

		// Create the canvas element for each object.
		var canvObj = createCanvasObject($this); // now can use $(canvObj) to do canvas methods

		// Get Max/Min/Ratio value of the object array
		var lowest = Number.POSITIVE_INFINITY;
		var highest = Number.NEGATIVE_INFINITY;
		var tmp;
		for (var key in opts.mapData) {
			tmp = opts.mapData[key];
			if(tmp < lowest) lowest = tmp;
			if(tmp > highest) highest = tmp;
		}
		var ratio = (1 - opts.mapSegmentMinLightness - (1-opts.mapSegmentMaxLightness))/(highest - lowest);

		var i = 0;
		for(var key in opts.mapData) {

			var x = getX(i);
			var y = getY(i);

			// Create square
			$(canvObj).drawRect({
				layer: true,
				fillStyle: getFillStyle(opts.mapData[key]), // This is the hard part (setting the color)
				x: getX(i),  // Starting from 0, then until max segmentCount is reached, then its value + segment width (in addition to borders)
				y: getY(i), // Starting from 0, then value + segmentHeight, then until max segmentCount is reached, the its back to 0
				strokeStyle: "rgba(37,51,148,0.1)",
				strokeWidth: 1,
				width: opts.mapColumnSegmentDimensions.width,
				height: opts.mapColumnSegmentDimensions.height,
				fromCenter: false, // MUST SET THIS FOR EASIER POSITIONING
				cornerRadius: opts.mapSegmentRadius,
				data: {
					dataValue : opts.mapData[key] // Use this for future repaints and other options (so we're not constantly looping over the data array)
				}
			});

			i++; // required
		};
	}


	$.fn.rtsHeatMap = function(options) {
		return this.each(function(){
			$this = $(this); // hurp
			if($this.data('rtsHeatMap')) return; // bailout if we already have the map init'd
			$this.data('rtsHeatMap',new RTSHeatMap($this, options));
		});
	};

}(jQuery));