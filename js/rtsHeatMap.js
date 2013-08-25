
(function($) {

	$.fn.rtsHeatMapDefaults =  {
		mapBackgroundcolor : "white", // background color of map, the canvas' element color

		mapHeight : null, // If null, i'll use the parent DOM height if possible (otherwise, fallback 200px).
		mapWidth : null, // If null, i'll use the parent DOM width

		mapSegmentColor : "#89bc62", // You must provide me and RGB value (rgb(255,255,255)) and i'll use this (in HSL format) only OR the word random, then i'll pick one for you
		mapSegmentRadius : 0,

		mapColumnSegmentDimensions : {width:15,height:15}, // Dimensions, in pixels. (10px height, 10px width)
		mapColumnMaxSegmentCount : 7, // The number of segments rendered per column

		mapData : {}, // Data for the map (object array)

		mapComplete : null // Once all maps have been renedered, i'll call this
	};

	$.fn.rtsHeatMap = function(options){

		var settings = $.extend({},$.fn.rtsHeatMapDefaults,options);

		// Private
		function createCanvasObject(domObj, opts)
		{
			// objID should be the parent's domObj. I'll use id to unique this guy, or a name
			var objName = "rtsMap";
			if(domObj.attr('id') != "") objName = domObj.attr('id')+"rtsHeatMap";

			return $('<canvas/>')
				.attr({
					'id' :objName,
					'height' : (opts.mapHeight) ? opts.mapHeight : $this.height(),
					'width' : (opts.mapWidth) ? opts.mapWidth : $this.width()
				})
				.css({
					'background-color' : opts.mapBackgroundcolor
				})
				.text('Your browser does not support canvas. Please upgrade your browser');
		}

		function log(msg) { console.log(msg); }

		// http://stackoverflow.com/questions/5623838/rgb-to-hex-and-hex-to-rgb (modified for this plugin)
		function hexToRgb(hex) {
		    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		    return result ? {r:parseInt(result[1], 16),g:parseInt(result[2], 16),b:parseInt(result[3], 16)} : null;
		}

		// http://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
		/**
		 * Converts an HSL color value to RGB. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
		 * Assumes h, s, and l are contained in the set [0, 1] and
		 * returns r, g, and b in the set [0, 255].
		 *
		 * @param   Number  h       The hue
		 * @param   Number  s       The saturation
		 * @param   Number  l       The lightness
		 * @return  Array           The RGB representation
		 */
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
		/**
		 * Converts an RGB color value to HSL. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
		 * Assumes r, g, and b are contained in the set [0, 255] and
		 * returns h, s, and l in the set [0, 1].
		 *
		 * @param   Number  r       The red color value
		 * @param   Number  g       The green color value
		 * @param   Number  b       The blue color value
		 * @return  Array           The HSL representation
		 */
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

		// Custom Helpers!
		Object.size = function(obj) {
			var size = 0, key;
			for (key in obj) if (obj.hasOwnProperty(key)) size++;
			return size;
		};

		// example : "{0} : {1}".format("string", "string")
		String.prototype.format = function() {
			var args = arguments;
			return this.replace(/\{(\d+)\}/g, function(match, number) { return typeof args[number] != 'undefined' ? args[number] : match; });
		};
		Array.prototype.max = function() {  return Math.max.apply(null, this); };
		Array.prototype.min = function() {  return Math.min.apply(null, this); };



		// Main Methods
		return this.each(function(){
			$this = $(this); // hurp

			// I support the Data option!
			// http://learn.jquery.com/plugins/advanced-plugin-concepts/
			var opts = $.extend({},settings,$this.data());

			// My random color do-hicky
			if(opts.mapSegmentColor == 'random')
				opts.mapSegmentColor = '#'+Math.floor(Math.random()*16777215).toString(16); // http://www.paulirish.com/2009/random-hex-color-code-snippets/

			// Create the canvas element for each object.
			var canvObj = createCanvasObject($this, opts); // now can use $(canvObj) to do canvas methods

			$(this).append(canvObj); // write the new canvas to the parent.

			// Get Max value of the object array
			var highest = Number.NEGATIVE_INFINITY;
			var tmp;
			for (var key in opts.mapData) {
				tmp = opts.mapData[key];
				if(tmp > highest) highest = tmp;
			}

			var i = 0;
			var columnCount = 0;
			for(var key in opts.mapData) {

				var val = opts.mapData[key];

				// Determine Fill Style
				fillStyle = hexToRgb(opts.mapSegmentColor); // This will either be null (it wasn't hex) or an string rgb value
				if(!fillStyle) fillStyle = opts.mapSegmentColor; // returns {r:0,g:0,b:0} object
				var hsl = rgbToHsl(fillStyle.r,fillStyle.g,fillStyle.b); // Canvas does accept hsl values. the L
				hsl.l = val / highest; // Need to determine the "L" instensity value.
				var rgb = hslToRgb(hsl.h,hsl.s,hsl.l);
				fillStyle = 'rgb({0},{1},{2})'.format(Math.round(rgb.r), Math.round(rgb.g), Math.round(rgb.b));

				// Determine X position (column)
				// if i % mapColumnMaxSegmentCount = 0, then we're at the start of a new column, x should be i + opts.mapColumnSegmentDimensions.width
				var x = columnCount * opts.mapColumnSegmentDimensions.width; // First value
				if(i !=0 && i % opts.mapColumnMaxSegmentCount == 0) // ... i'm at the start of a new column
					x = (++columnCount) * opts.mapColumnSegmentDimensions.width; // Move x over, increase ColumnCount for next trip

				// Determine Y position (row)
				var y = (i % opts.mapColumnMaxSegmentCount == 0) ? 0 : y;
				if(i % opts.mapColumnMaxSegmentCount > 0) { // I'm withing a column, keep adding height
					y += opts.mapColumnSegmentDimensions.height;
				}

				//log('I: ' + i + ' X: ' + x + ' ColumnCount: ' + columnCount + ' MOD: ' + (i % opts.mapColumnMaxSegmentCount));

				// Create square
				$(canvObj).drawRect({
					fillStyle: fillStyle, // This is going to be the hard part (setting the color)
					x: x,  // Starting from 0, then until max segmentCount is reached, then its value + segment width (in addition to borders)
					y: y, // Starting from 0, then value + segmentHeight, then until max segmentCount is reached, the its back to 0
					strokeStyle: "rgba(37,51,148,0.1)",
					strokeWidth: 1,
					width: opts.mapColumnSegmentDimensions.width,
					height: opts.mapColumnSegmentDimensions.height,
					fromCenter: false, // MUST SET THIS FOR EASIER POSITIONING
					cornerRadius: opts.mapSegmentRadius
				});

				i++; // required
			};



		});

	};

}(jQuery));