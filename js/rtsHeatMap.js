
(function($) {

	$.fn.rtsHeatMapDefaults =  {
		mapBackgroundcolor : "white", // background color of map, the canvas' element color

		mapHeight : null, // If null, i'll use the parent DOM height if possible (otherwise, fallback 200px).
		mapWidth : null, // If null, i'll use the parent DOM width

		mapSegmentColors : {}, // You can provide either a range of colors (between three values), or if 4 our more, i'll do some crazy math. 2 or less will result in my defaults, not yours. Not sure i like this...
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

		function tempTorgb(data, max) {
			var temp = data / max;
			var red = blue = green = 0;
			if(temp >= 0 && temp < .5) { //green stays at 100% and red raises to 100%
				green = 1;
				red = 2 * temp;
			}
			if (temp >= .5 && temp <= 1) { //red stays at 100% and green decays
				red = 1;
				green = 2 * (1- temp); //1 - 2 * ($temp - 0.5);
			}
			red = Math.round(red * 255);
			green = Math.round(green * 255);
			return 'rgba({0},{1},{2},{3})'.format(red,green,blue,temp/.2);
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

			// Create the canvas element for each object.
			var canvObj = createCanvasObject($this, opts); // now can use $(canvObj) to do canvas methods

			$(this).append(canvObj); // write the new canvas to the parent.

			// Do work (simple, i'll make it better later)
			/*
			$i = 0;
			foreach($data as $k => $v) {
				$created = date_create($k);
				$dayOfYear = $created->format('z'); // Starts at 0 ends at 364
				$dayOfWeek = $created->format('N'); // Starts at 1 (Monday), ends at 7 (Sunday)
				$class = tempTorgb($v,$scaleBase);
				if($v == 0 && $created->format('U') - time() > 0) // If a future date, we don't have data, so show white instead
					$class = 'white';

				if($i == 0) echo sprintf('<div class="col">'); // If first day of a valid week

				$divClass = ($created->format('Y') != $thisYear) ? 'square past' : 'square'; // Don't want to show a old square value!
				$class = ($created->format('Y') != $thisYear) ? 'none' : $class;

				echo sprintf('<div title="%s: %s" class="%s" style="background-color:%s"></div>',$created->format('l m/d/Y'), $v,$divClass, $class);

				if($i++ == 6 || ($created->format('Y') == $thisYear && $dayOfYear == 365)) {
					$i = 0; // reset so we can start a new week
					echo sprintf('</div>');
				}
			}
			*/

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
				var fillStyle = tempTorgb(val,highest);

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