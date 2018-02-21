(function () {
    initTooltip('bottom');

    var chart;
    var $strokeSettings = $('#select-stroke-settings');
    var $colorPickerFill = $('.color-picker[data-color="fill"]');
    var $colorPickerStroke = $('.color-picker[data-color="stroke"]');
    var $annotationLabel;
    // var $markerSize = $('#select-marker-size');
    var $markerSize = $('.volume-btn[data-el-size="marker"]');
    var $fontSize = $('.volume-btn[data-el-size="label"]');
    var $markerSizeBtn = $('.select-marker-size');
    var $fontSettings = $('#select-font-style');

    var $labelMethod = $('[data-label-method]');

    $(function () {
        // page UI elements
        createPageColorPicker();

        // init selectpicker
        $('.selectpicker').selectpicker({
            iconBase: 'ac',
            tickIcon: 'ac-check'
        });

        // init volume bars
        // marker-size, font-size
        initVolumeBar();

        // data from https://cdn.anychart.com/csv-data/msft-daily-short.js
        var data = get_msft_daily_short_data();

        // Create new chart object.
        chart = anychart.stock();

        // create data table
        var table = anychart.data.table(0);
        table.addData(data);

        // create data mappings
        var mapping = table.mapAs({'value': 4});

        // create line series
        chart.plot(0).line(mapping)
            .stroke('2 #253992')
            .name('MSFT');

        // create ema indicator
        chart.plot(0).ema(mapping, 50, 'spline')
            .series()
            .stroke('#DB2A0E');

        // create scroller series
        chart.scroller().area(mapping)
            .color('#253992 0.3')
            .stroke('#253992');

        // set grid and axis settings
        chart.plot(0).yAxis(0).orientation('right');
        chart.plot(0).yAxis(1)
            .orientation('left')
            .ticks(false)
            .labels(false)
            .minorLabels(false);
        chart.plot()
            .xGrid(true)
            .yGrid(true);

        // set chart padding
        chart.padding()
            .right(35)
            .left(5)
            .top(10);

        // add annotation items in context menu
        chart.contextMenu().itemsFormatter(contextMenuItemsFormatter);

        // use annotation events to update application UI elements
        chart.listen('annotationDrawingFinish', onAnnotationDrawingFinish);
        chart.listen('annotationSelect', onAnnotationSelect);
        chart.listen('annotationUnSelect', function () {
            $colorPickerFill.removeAttr('disabled');
            // $markerSizeBtn.removeAttr('disabled');
            $('.drawing-tools-solo').find('.bootstrap-select').each(function () {
                $(this).removeClass('open');
            })
        });
        chart.listen('chartDraw', function () {
            hidePreloader();

            var $body = $('body');
            var $textArea = '<textarea id="annotation-label"></textarea>';

            if (!$body.find('#annotation-label').length) {
                $body.find('[data-annotation-type="label"]').length ?
                    $body.find('[data-annotation-type="label"]').after($textArea) :
                    $body.append($textArea);
                $annotationLabel = $('#annotation-label');
            }
        });

        // add textarea for label annotation and listen events
        chart.listen('annotationDrawingFinish', function (e) {
            if (e.annotation.type === 'label') {

                $annotationLabel.val(e.annotation.text())
                    .focus()
                    .on('change keyup paste', function (e) {
                        if (e.keyCode === 46) return;

                        try {
                            var annotation = chart.annotations().getSelectedAnnotation();
                            annotation.enabled();
                        } catch (err) {
                            annotation = null;
                        }

                        if (annotation) {
                            $(this).val() ? annotation.text($(this).val()) : annotation.text(' ') && $(this).val(' ');
                        }
                    });

                chart.listen('annotationDrawingFinish', function (e) {
                    if (e.annotation.type === 'label') {
                        $annotationLabel.val(e.annotation.text())
                            .focus();
                    }
                });

                chart.listen('annotationSelect', function (e) {
                    if (e.annotation.type === 'label') {
                        $annotationLabel.val(e.annotation.text())
                            .focus();
                    }
                });

                chart.listen('annotationUnselect', function () {
                    if (e.annotation.type === 'label') {
                        $annotationLabel.val('');
                    }
                });
            }
        });

        // set container id for the chart
        chart.container('chart-container');

        // initiate chart drawing
        chart.draw();
    });

    function initVolumeBar() {
        $('.volume-btn').on('mouseenter', function () {
            var self = this;

            $(this).popover({
                placement: 'bottom',
                html: true,
                trigger: 'manual',
                content: function () {
                    return '<div id="volume-popover">\n' +
                        '     <div class="volume-bar-value text-center">' + $(this).attr('data-volume') + 'px' +
                        '     </div>\n' +
                        '     <input type="range" id="volume-bar" class="volume-bar" step="1" value="' + $(this).attr('data-volume') + '"' +
                        '      min="5" max="35">\n' +
                        '   </div>'
                }
            });

            $(this).popover('show');

            $(this).siblings('.popover').on('mouseleave', function () {
                setTimeout(function () {
                    if (!$('.popover:hover').length) {
                        $(self).popover('hide')
                    }
                }, 100);
            });
        }).on('mouseleave', function () {
            var self = this;

            setTimeout(function () {
                if (!$('.popover:hover').length) {
                    $(self).popover('hide')
                }
            }, 100);
        });
    }

    function createPageColorPicker() {
        var colorPicker = $('.color-picker');
        var strokeWidth;
        var STROKE_WIDTH = 1;
        colorPicker.colorpicker({
            'color': '#e06666',
            'align': 'left'
        });

        colorPicker.on('create', function () {
            var color = $(this).data('color');

            if ($(this).find('.color-fill-icon[data-color]').length) {
                color = $(this).find('.color-fill-icon').attr('data-color');
            }

            $('.color-fill-icon', $(this)).css('background-color', color);
        });

        colorPicker.on('showPicker', function () {
            $(this).parent('div').find('.tooltip.in').tooltip('hide');
        });

        colorPicker.on('changeColor', function () {
            var color = $(this).data('color');
            var annotation = chart.annotations().getSelectedAnnotation();
            var _annotation = annotation;

            if (annotation) {
                if (annotation.type === 'label') {
                    $annotationLabel.focus();
                    annotation = annotation.background();
                }

                switch ($(this).attr('data-color')) {
                    case 'fill' :
                        annotation.fill(color);
                        break;
                    case 'stroke' :
                        strokeWidth = annotation.stroke().thickness || STROKE_WIDTH;
                        strokeDash = annotation.stroke().dash || '';
                        var settings = {
                            thickness: strokeWidth,
                            color: color,
                            dash: strokeDash
                        };

                        setAnnotationStrokeSettings(annotation, settings);
                        break;
                    case 'fontColor':
                        if (_annotation.type === 'label') _annotation.fontColor(color);
                        break;
                }
            }

            if (color === null) {
                $('.color-fill-icon', $(this)).addClass('colorpicker-color');
            } else {
                $('.color-fill-icon', $(this)).removeClass('colorpicker-color')
                    .css('background-color', color);
            }
        });
    }

    function removeSelectedAnnotation() {
        var annotation = chart.annotations().getSelectedAnnotation();
        if (annotation) chart.annotations().removeAnnotation(annotation);

        return !!annotation;
    }

    function removeAllAnnotation() {
        chart.annotations().removeAllAnnotations();
    }

    function onAnnotationDrawingFinish() {
        setToolbarButtonActive(null);
    }

    function onAnnotationSelect(evt) {
        var annotation = evt.annotation;
        var colorFill;
        var colorStroke;
        var strokeWidth;
        var strokeDash;
        var strokeType;
        var markerSize;
        var fontColor;
        var fontSize;

        var $colorPickerFontColor = $('.color-picker[data-color="fontColor"]');

        var fontSettings = [];

        if (annotation.fill || annotation.background) {
            $colorPickerFill.removeAttr('disabled');
            colorFill = annotation.fill ? annotation.fill() : annotation.background().fill();
            colorStroke = annotation.stroke ? annotation.stroke() : annotation.background().stroke();
        } else {
            $colorPickerFill.attr('disabled', 'disabled');
        }

        if (annotation.type === 'label') {
            $annotationLabel.focus();

            fontSize = annotation.fontSize();

            $fontSize.attr('data-volume', fontSize);

            fontColor = annotation.fontColor();

            fontSettings = [];

            $labelMethod.each(function () {
                var method = $(this).data().labelMethod;

                fontSettings.push(annotation[method]());
            });

            // update font settings select
            $fontSettings.val(fontSettings).selectpicker('refresh');

            annotation = annotation.background();
        }

        if (annotation.fill && typeof annotation.fill() === 'function') {
            colorFill = $colorPickerFill.find('.color-fill-icon').css('background-color');
        }

        if (colorStroke !== 'none') {
            colorStroke = annotation.stroke().color;
            strokeWidth = annotation.stroke().thickness;
            strokeDash = annotation.stroke().dash;
        }

        if (annotation.type === 'marker') {
            markerSize = annotation.size();
            $markerSize.attr('data-volume', markerSize);
        } else {
            $markerSizeBtn.attr('disabled', 'disabled');
        }

        if (annotation.fill !== undefined) {
            annotation.fill(colorFill);
        }

        if (fontSize) {
            evt.annotation.fontSize(fontSize);
        }

        switch (strokeDash) {
            case '1 1' :
                strokeType = 7;
                break;
            case '10 5' :
                strokeType = 8;
                break;
            default :
                if (strokeWidth) {
                    strokeType = 6;
                }
                break;
        }

        $colorPickerFill.find('.color-fill-icon').css('background-color', colorFill);
        $colorPickerStroke.find('.color-fill-icon').css('background-color', colorStroke);
        $colorPickerFontColor.find('.color-fill-icon').css('background-color', fontColor);
        $strokeSettings.val([strokeWidth, strokeType]).selectpicker('refresh');
    }

    function contextMenuItemsFormatter(items) {
        // insert context menu item on 0 position
        items['annotations-remove-selected'] = {
            text: "Remove selected annotation",
            action: removeSelectedAnnotation,
            index: -10
        };

        // insert context menu item on 1 position
        items['annotations-remove-all'] = {
            text: "Remove all annotations",
            action: removeAllAnnotation,
            index: -5
        };

        // insert context menu separator
        items['annotations-separator'] = {
            index: -4
        };

        return items;
    }

    function setToolbarButtonActive(type, markerType) {
        var $buttons = $('.btn[data-annotation-type]');
        $buttons.removeClass('active');
        $buttons.blur();

        if (type) {
            var selector = '.btn[data-annotation-type="' + type + '"]';
            if (markerType) selector += '[data-marker-type="' + markerType + '"]';
            $(selector).addClass('active');
        }
    }

    function updatePropertiesBySelectedAnnotation(colorStroke, strokeWidth, strokeType) {
        var annotation = chart.annotations().getSelectedAnnotation();
        if (annotation === null) return;

        if (annotation.type === 'label') {
            $annotationLabel.focus();
            annotation = annotation.background();
        }

        switch (strokeType) {
            case '6' :
                strokeType = null;
                break;
            case '7' :
                strokeType = '1 1';
                break;
            case '8' :
                strokeType = '10 5';
                break;
        }

        var settings = {
            thickness: strokeWidth,
            color: colorStroke,
            dash: strokeType
        };

        setAnnotationStrokeSettings(annotation, settings);
    }

    function setAnnotationStrokeSettings(annotation, settings) {
        annotation.stroke(settings);
        if (annotation.hovered || annotation.selected) {
            annotation.hovered().stroke(settings);
            annotation.selected().stroke(settings);
        }
    }

    function hidePreloader() {
        $('#loader-wrapper').fadeOut('slow');
    }

    function initTooltip(position) {
        $(document).ready(function () {
            $('[data-toggle="tooltip"]').tooltip({
                'placement': position,
                'animation': false
            }).on('show.bs.tooltip', function () {
                if ($(this).hasClass('color-picker') && $('.colorpicker-visible').length) {
                    return false
                }
            })
        });
    }

    function normalizeFontSettings(val) {
        var fontMethods = {};

        $labelMethod.each(function () {
            fontMethods[$(this).data().labelMethod] = null;
        });

        val && val.forEach(function (item) {
            if (item) {
                $fontSettings.find('[data-label-method]').each(function () {
                    var $that = $(this);
                    var $el = $(this).find('option').length ? $(this).find('option') : $(this);

                    $el.each(function () {
                        if ($(this).val() === item) {
                            fontMethods[$that.attr('data-label-method')] = item;
                        }
                    });
                });
            }
        });

        return fontMethods
    }

    $(document).ready(function () {
            $('select.choose-drawing-tools').on('change', changeAnnotations);
            $('select.choose-marker').on('change', changeAnnotations);
            $('[data-annotation-type]').on('click', changeAnnotations);

            $('#annotation-label-autosize').on('click', function () {
                var annotation = chart.annotations().getSelectedAnnotation();

                if (annotation && annotation.type === 'label') {
                    annotation.width(null);
                    annotation.height(null);
                }

                setToolbarButtonActive(null);

                $annotationLabel.focus();
            });

            function changeAnnotations() {
                var $that = $(this);

                setTimeout(function () {
                    var $target = $that;
                    var active = $target.hasClass('active');
                    var markerSize = $markerSize.attr('data-volume');
                    var fontSize = $fontSize.attr('data-volume');
                    var fontColor = $('[data-color="fontColor"]').find('.color-fill-icon').css('background-color');

                    var colorFill = $colorPickerFill.find('.color-fill-icon').css('background-color');
                    var colorStroke = $colorPickerStroke.find('.color-fill-icon').css('background-color');

                    var strokeType;
                    var strokeWidth;
                    var strokeDash;
                    var STROKE_WIDTH = 1;

                    if ($strokeSettings.val()) {
                        switch ($strokeSettings.val()[0]) {
                            case '6' :
                            case '7' :
                            case '8' :
                                strokeType = $strokeSettings.val()[0];
                                strokeWidth = $strokeSettings.val()[1] || STROKE_WIDTH;
                                break;
                            default :
                                strokeWidth = $strokeSettings.val()[0];
                                strokeType = $strokeSettings.val()[1];
                                break;
                        }
                    }

                    switch (strokeType) {
                        case '6' :
                            strokeDash = null;
                            break;
                        case '7' :
                            strokeDash = '1 1';
                            break;
                        case '8' :
                            strokeDash = '10 5';
                            break;
                    }

                    var strokeSettings = {
                        thickness: strokeWidth,
                        color: colorStroke,
                        dash: strokeDash
                    };

                    var fontSettings = normalizeFontSettings($fontSettings.val());

                    if (active) {
                        chart.annotations().cancelDrawing();
                        setToolbarButtonActive(null);
                    } else {
                        var type = $target.data().annotationType || $target.find('option:selected').data().annotationType;

                        if (!$target.data().annotationType) {
                            var markerType = $target.find('option:selected').data().markerType;
                        }

                        setToolbarButtonActive(type, markerType);

                        if (type) {

                            if (!$target.data().annotationType) {
                                var markerAnchor = $target.find('option:selected').data().markerAnchor;
                            }

                            var drawingSettings = {
                                type: type,
                                size: markerSize,
                                markerType: markerType,
                                anchor: markerAnchor,
                                fontSize: fontSize,
                                fontColor: fontColor
                            };

                            $.extend(drawingSettings, fontSettings);

                            if (type === 'label') {
                                drawingSettings.anchor = fontSettings.anchor;

                                drawingSettings.background = {
                                    fill: colorFill,
                                    stroke: strokeSettings
                                };
                                drawingSettings.hovered = {
                                    background: {
                                        stroke: strokeSettings
                                    }
                                };
                                drawingSettings.selected = {
                                    background: {
                                        stroke: strokeSettings
                                    }
                                };
                            } else {
                                drawingSettings.fill = colorFill;
                                drawingSettings.stroke = strokeSettings;
                                drawingSettings.hovered = {
                                    stroke: strokeSettings
                                };
                                drawingSettings.selected = {
                                    stroke: strokeSettings
                                };
                            }

                            chart.annotations().startDrawing(drawingSettings);
                        }
                    }

                    var annotation = chart.annotations().getSelectedAnnotation();

                    if (annotation.fill || annotation.background) {
                        $colorPickerFill.removeAttr('disabled');
                    } else {
                        $colorPickerFill.attr('disabled', 'disabled');
                    }

                    $target.val('');
                }, 1);
            }

            $('.btn[data-action-type]').click(function (evt) {
                var annotation = chart.annotations().getSelectedAnnotation();
                var $target = $(evt.currentTarget);
                $target.blur();
                var type = $target.attr('data-action-type');

                switch (type) {
                    case 'removeAllAnnotations':
                        removeAllAnnotation();
                        break;
                    case 'removeSelectedAnnotation' :
                        removeSelectedAnnotation();
                        break;
                    case 'unSelectedAnnotation' :
                        chart.annotations().unselect(annotation).cancelDrawing();
                        setToolbarButtonActive(null);
                        break;
                }

            });

            $strokeSettings.on('change', function () {
                var strokeWidth;
                var strokeType;
                var STROKE_WIDTH = 1;
                var colorStroke = $colorPickerStroke.find('.color-fill-icon').css('background-color');

                if ($(this).val()) {
                    switch ($(this).val()[0]) {
                        case '6' :
                        case '7' :
                        case '8' :
                            strokeType = $(this).val()[0];
                            strokeWidth = $(this).val()[1] || STROKE_WIDTH;
                            break;
                        default :
                            strokeType = $(this).val()[1];
                            strokeWidth = $(this).val()[0];
                            break;
                    }

                    updatePropertiesBySelectedAnnotation(colorStroke, strokeWidth, strokeType);
                }
            });

            $markerSize.on('change', function () {
                var annotation = chart.annotations().getSelectedAnnotation();

                if (annotation && annotation.type === 'marker') {
                    annotation.size($(this).val());
                }
            });

            $('body').on('change', '.volume-bar', function () {
                var annotation = chart.annotations().getSelectedAnnotation();

                var $popover = $(this).closest('.popover');

                $popover.prev('.volume-btn')
                    .attr('data-volume', $(this).val());

                $popover.find('.volume-bar-value').text($(this).val() + 'px');

                if (annotation && annotation.type === 'label' &&
                    $popover.prev('.volume-btn').attr('data-el-size') === 'label') {
                    annotation.fontSize($(this).val());
                    $annotationLabel.focus();
                } else if (annotation && annotation.type === 'marker' &&
                    $popover.prev('.volume-btn').attr('data-el-size') === 'marker') {
                    annotation.size($(this).val());
                }
            });

            $fontSettings.on('change', function () {
                var annotation = chart.annotations().getSelectedAnnotation();

                if (annotation && annotation.type === 'label') {

                    var fontSettings = normalizeFontSettings($(this).val());

                    $labelMethod.each(function () {
                        var method = $(this).data().labelMethod;

                        annotation[method](fontSettings[method]);
                    });

                    $annotationLabel.focus();
                }
            });

            $('html').keyup(function (e) {
                if (e.keyCode === 46) {
                    removeSelectedAnnotation();
                }
            })
        }
    );
})();