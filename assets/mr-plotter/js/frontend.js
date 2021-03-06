/*
 * Copyright (C) 2016 Sam Kumar, Michael Andersen, and the University
 * of California, Berkeley.
 *
 * This file is part of Mr. Plotter (the Multi-Resolution Plotter).
 *
 * Mr. Plotter is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Mr. Plotter is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Mr. Plotter.  If not, see <http://www.gnu.org/licenses/>.
 */

function init_frontend(self) {
    self.idata.streamList = [];
    self.idata.dateFormat = "%a %b %d, %Y %T";
    self.idata.dateConverter = new AnyTime.Converter({format: self.idata.dateFormat});
    self.idata.labelFormatter = new AnyTime.Converter({format: self.idata.dateFormat, utcFormatOffsetImposed: 0});
    self.idata.makeColorMenu = s3ui.makeMenuMaker();
    self.idata.streamSettings = {}; // Stores the stream settings chosen in the legend (maps uuid to a setting object)
    self.idata.selectedStreamsBuffer = self.idata.selectedStreams; // Streams that have been selected and are displayed in the legend
    self.idata.streamMessages = {}; // Maps a stream's uuid to a 2-element array containing 1) an object mapping importances (ints) to messages and 2) the importance of the current message being displayed

    self.idata.addedStreams = undefined;
    self.idata.changedTimes = undefined;
    self.idata.otherChange = undefined;
    self.idata.automaticAxisUpdate = false; // True if axes will be updated without the need for an "Update Axes" button
    self.idata.initPermalink = window.location.protocol + "//" + self.backend + window.location.pathname + '?'; // The start of the permalink
    self.idata.loadedPermalink = false;
    self.idata.selectedLegendEntry = undefined; // The currently selected legend entry
    self.idata.chart = self.find("svg.chart");
    self.idata.widthFunction = function () {
      var $parent = $(self.find('.chartContainer'));
            // Check to see if sidebar is showing. We need to use the outermost container
            // for width calculations because if we check the charts own width then 
            // the chart expands when the viewport increases, but won't shrink when the
            // viewport becomes smaller
            var sidebarHidden = $('#toggle_column').css("display") == "none";
            var widthDispTable = $('table.dispTable').css("width");
            var widthDT = parseInt(widthDispTable);
            var width = sidebarHidden ? widthDT : widthDT * .8;
            var leftpadding = $parent.css("padding-left");
            var rightpadding = $parent.css("padding-right");
            var leftborder = $parent.css("border-left-width");
            var rightborder = $parent.css("border-right-width");
            var totalNonContentWidth = [leftpadding, rightpadding, leftborder, rightborder]
                .map(s3ui.parsePixelsToInt)
                .reduce(function(pv, cv) {return pv + cv});
            return width - totalNonContentWidth;
    };

    self.idata.changingpw = false;
    self.idata.defaultLoginMenuText = "Log in ";
  self.idata.prevLoginMenuText = self.idata.defaultLoginMenuText;

}

function toggle_visibility(id) {
    var e = document.getElementById(id);
    if(e.style.display == "block") {
       $("#toggler").html( "&rarr; Show" );
       e.style.display = "none";
       e.style.width = "0%";
     } else {
       $("#toggler").html( "&larr; Hide" );
       e.style.display = "block";
       $("#toggle_column").animate({"width" : "99%"}, 100);
     }
 };


/* Adds or removes (depending on the value of SHOW) the stream
    described by STREAMDATA to or from the legend. UPDATE is true if
    applySettings should be immediately called after insertion or removal. */
function toggleLegend (self, show, streamdata, update) {
    if (update == undefined) {
        update = true;
    }
    self.idata.drawnBefore = false;
    var streamSettings = self.idata.streamSettings;
  var nameElem;
  
    if (show) {
        if (streamSettings.hasOwnProperty(streamdata.uuid) && streamSettings[streamdata.uuid].active) {
            return;
        }
        self.idata.selectedStreamsBuffer.push(streamdata);

        var row = d3.select(self.find("tbody.legend"))
          .append("tr")
            .datum(streamdata)
            .attr("class", function (d) { return "legend-" + d.uuid; });
      row.append('td').
        attr('class', 'reorder-legend').
        html('<span class="glyphicon glyphicon-menu-hamburger"></span>');
      
        var colorMenu = row.append("td")
            .append(self.idata.makeColorMenu)
            .attr("class", function (d) { return "color-" + d.uuid; })
          .node();
        colorMenu.onchange = function () {
                var newColor = this[this.selectedIndex].value;
                streamSettings[streamdata.uuid].color = newColor;
                self.$("g.series-" + streamdata.uuid).attr({
                        "stroke": newColor,
                        "fill": newColor
                    });

                var legendColor = self.$(".legendcolor-" + streamdata.uuid).attr({
                        "fill": newColor
                    });

                // console.log(legendColor);

                s3ui.applyDisplayColor(self, self.idata.axisMap[streamSettings[streamdata.uuid].axisid], streamSettings);
                self.$("polyline.density-" + streamdata.uuid).attr("stroke", newColor);
                color = [parseInt(newColor.slice(1, 3), 16), parseInt(newColor.slice(3, 5), 16), parseInt(newColor.slice(5, 7), 16)].join(", ");
                if (self.idata.selectedLegendEntry == nameElem) {
                    nameCell.style("background-color", "rgba(" + color + ", 0.3)");
                }

                // console.log(".legendcolor-" + streamdata.uuid);
                // CHANGING CHART LEGEND COLORS

            };
        streamSettings[streamdata.uuid] = { color: colorMenu[colorMenu.selectedIndex].value, axisid: "y1", active: true }; // axisid is changed
        self.idata.streamMessages[streamdata.uuid] = [{0: ""}, 0];
        var color = streamSettings[streamdata.uuid].color;
        color = [parseInt(color.slice(1, 3), 16), parseInt(color.slice(3, 5), 16), parseInt(color.slice(5, 7), 16)].join(", ");
        var nameCell = row.append("td")
            .html(function (d) { return s3ui.getFilepath(d); })
            .attr("class", "streamName streamName-" + streamdata.uuid);



        nameElem = nameCell.node();
        nameElem.onclick = function () {
                if (self.idata.selectedLegendEntry == nameElem) {
                    self.idata.selectedLegendEntry = undefined;
                    setStreamMessage(self, streamdata.uuid, undefined, 4);
                    s3ui.hideDataDensity(self);
                    nameCell.style("background-color", "rgba(" + color + ", 0.1)");
                    $(self.find(".metadataDisplay")).empty();
                } else {
                    if (self.idata.selectedLegendEntry != undefined) {
                        var oldSelection = self.idata.selectedLegendEntry;
                        oldSelection.onclick(); //deselect the previous selection
                        self.idata.selectedLegendEntry = nameElem;
                        oldSelection.onmouseout();
                    } else {
                        self.idata.selectedLegendEntry = nameElem;
                    }
                    if (self.idata.oldData.hasOwnProperty(streamdata.uuid)) {
                        var xdomain = self.idata.oldXScale.domain();
                        setStreamMessage(self, streamdata.uuid, "Interval width: " + s3ui.nanosToUnit(Math.pow(2, self.idata.oldData[streamdata.uuid][2])), 4);
                    }
                    s3ui.showDataDensity(self, streamdata.uuid);
                    nameCell.style("background-color", "rgba(" + color + ", 0.3)");
                    self.find(".metadataDisplay").innerHTML = "<h3>Stream Metadata</h3>" + s3ui.getInfo(streamdata, "<br>");
                }
                s3ui.updateVertCursorStats(self);
                s3ui.updateHorizCursorStats(self);
            };
        var hovered = false;
        nameElem.onmouseover = function () {
                hovered = true;
                if (self.idata.selectedLegendEntry != nameElem) {
                    nameCell.style("background-color", "rgba(" + color + ", 0.1)");
                }
            };
        nameElem.onmouseout = function () {
                hovered = false;
                if (self.idata.selectedLegendEntry != nameElem) {
                    nameCell.style("background-color", "");
                }
            };
        var selectElem = row.append("td")
          .append("select")
            .attr("class", "axis-select form-control axis-select-" + streamdata.uuid)
            .attr("style", "padding: 0px; min-width: 4em;");
        selectElem.selectAll("option")
          .data(self.idata.yAxes.filter(s3ui.getPSLAxisFilter(streamdata))) // The filter was added at PSL's request
          .enter()
          .append("option")
            .attr("class", function (d) { return "option-" + d.axisid; })
            .attr("value", function (d) { return d.axisid; })
            .html(function (d) { return d.axisname; });
        var selectNode = selectElem.node();
        var initIndex = s3ui.guessYAxis(self, streamdata); // use a heuristic to get the initial selection
        if (initIndex == undefined) { // when guessYAxis returns undefined no match was found
            initIndex = self.idata.yAxes.length;
            s3ui.addYAxis(self);
        }
        /** Fundamentally this next line is trying to auto choose the select option for the y axis but it's using the actual index among all yaxes when above we filtered out almost all the options to only ones that match. This will almost always be 0 in other words. */
        // selectNode.selectedIndex = initIndex; // Setting this programmatically to a value that doesn't exist triggers errors. 
        selectNode.setAttribute("data-prevselect", selectNode[selectNode.selectedIndex].value);
        selectNode.onchange = function (event, suppressUpdate) {
                var newID = this[this.selectedIndex].value;
                s3ui.changeAxis(self, streamdata, this.getAttribute("data-prevselect"), newID);
                this.setAttribute("data-prevselect", newID);
                if (suppressUpdate == undefined) {
                    s3ui.applySettings(self, false);
                }
            };
        var intervalWidth = row.append("td").attr("class", "message-" + streamdata.uuid).node();
        s3ui.changeAxis(self, streamdata, null, selectNode[selectNode.selectedIndex].value);
        $("select.color-" + streamdata.uuid).simplecolorpicker({picker: true});
        if (update) { // Go ahead and display the stream
            s3ui.applySettings(self, true);
        }
    } else {
        if (!streamSettings.hasOwnProperty(streamdata.uuid) || !streamSettings[streamdata.uuid].active) {
            return;
        }
        nameElem = self.idata.selectedLegendEntry;
        if (nameElem != undefined && nameElem.className == "streamName streamName-" + streamdata.uuid) {
            nameElem.onclick();
            nameElem.onmouseout(); // Deselect the stream before removing it
        }
        var toRemove = self.find(".legend-" + streamdata.uuid);
        var selectElem = d3.select(toRemove).select('.axis-select').node();
        var oldAxis = selectElem[selectElem.selectedIndex].value;
        s3ui.changeAxis(self, streamdata, oldAxis, null);
        toRemove.parentNode.removeChild(toRemove);

        // we could delete self.idata.streamSettings[streamdata.uuid]; but I want to keep the settings around
        streamSettings[streamdata.uuid].active = false;
        for (var i = 0; i < self.idata.selectedStreamsBuffer.length; i++) {
            if (self.idata.selectedStreamsBuffer[i].uuid == streamdata.uuid) {
              self.idata.selectedStreamsBuffer.splice(i, 1);
                break;

            }
        }

      

        if (update) {
            s3ui.applySettings(self, false); // Make stream removal visible on the graph
        }

    }
}

/* Sets the message to be displayed for a certain importance; the message with
   the highest importanced is displayed. */
function setStreamMessage(self, uuid, message, importance) {
    var messages = self.idata.streamMessages[uuid];
    messages[0][importance] = message;
    var messageLoc;
    if (message == undefined) {
        if (importance == messages[1]) {
            while (messages[0][importance] == undefined) {
                importance--;
            }
            messages[1] = importance;
            messageLoc = self.find(".message-" + uuid);
            if (messageLoc != null) {
                messageLoc.innerHTML = messages[0][importance];
            }
        }
    } else if (importance >= messages[1]) {
        messages[1] = importance;
        messageLoc = self.find(".message-" + uuid)
        if (messageLoc != null) {
            messageLoc.innerHTML = message;
        }
    }
}

function updatePlotMessage(self) {
    var message = "";
    if (self.idata.changedTimes) {
        message = 'Click "Apply Date Range and Plot" to update the graph, using the selected the start and end times.';
    } else if (self.idata.addedStreams || self.idata.otherChange) {
        message = 'Click "Apply Settings" below to update the graph.';
    }
    self.find(".plotLoading").innerHTML = message;
}

function getSelectedTimezone(self) {
    var timezoneSelect = self.find(".timezoneSelect");
    var dst = (self.find("#dst-checkbox").checked);
    var selection = timezoneSelect[timezoneSelect.selectedIndex].value;
    if (selection == "OTHER") {
        /* This is too early to perform the input sanitization in case someone is injecting a <script> here,
         * because the entry has to given to timezoneJS to look up the timezone.
         * The sanitization has to happen right before the timezone is ever written to the screen in any way.
         */
        selection = self.find(".otherTimezone").value.trim();
    }
    return [selection, dst];
}

function createPlotDownload(self) {


    var chartElem = self.find(".chart");
//    var legend = self.find("#legend-container");
    var chartData = chartElem.innerHTML.replace(/[\d.]+em/g, function (match) {
            return (parseFloat(match.slice(0, match.length - 2)) * 16) + "px";
        });
    var chartData = chartData.replace(">\n</tspan>", " font-color=\"white\"></tspan>"); // So it renders correctly in Inkview
    var graphStyle = self.find(".plotStyles").innerHTML;
  var plotWidth = chartElem.getAttribute("width");// + legend.getAttribute("width");
  var plotHeight = chartElem.getAttribute("height"); //Math.max(, legend.getAttribute("height") + 100);
    var xmlData = '<svg xmlns="http://www.w3.org/2000/svg" width="' + plotWidth + '" height="' + plotHeight + '" font-family="serif" font-size="16px">'
        + '<defs><style type="text/css"><![CDATA[' + graphStyle + ']]></style></defs>' + chartData + '</svg>';

    var downloadAnchor = document.createElement("a");
    downloadAnchor.innerHTML = "Download as SVG";
    downloadAnchor.setAttribute("href", 'data:application/octet-stream;charset=utf-8,' + encodeURIComponent(xmlData));
    downloadAnchor.setAttribute("download", "graph.svg");

    var linkLocation = self.find(".download-graph");
    linkLocation.innerHTML = ""; // Clear what was there before...
    linkLocation.insertBefore(downloadAnchor, null); // ... and replace it with this download link
    //downloadAnchor.click();

    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var image = new Image();
    var imageLoadedRan = false;
    var imageLoaded = function() {
        if (imageLoadedRan) return
        imageLoadedRan = true;
        canvas.height = plotHeight;
        canvas.width = plotWidth;

        // this uses a library as a workaround for IE
        if (window.canvg) canvg(canvas, xmlData)
        // this works everywhere else
        else context.drawImage(image, 0, 0);

        var a = document.createElement("a");
        a.download = "graph.png";
        a.href = canvas.toDataURL("image/png");
        a.innerHTML = "Download as PNG";
        var wrapper = document.createElement('div');
        
        // IE also does not support using anchor tags to download images
        // so this is another work around
        if (window.canvg) { // from a library conditionally loaded only for IE
            // replace the href with click handlers that download blobs for both links
            a.href = "";
            downloadAnchor.href = "";
            a.addEventListener('click', function(e) {
                e.preventDefault();
                window.navigator.msSaveBlob(canvas.msToBlob(), 'mrplotter-graph.png');
            });
            downloadAnchor.addEventListener('click', function(e) {
                e.preventDefault();
                window.navigator.msSaveBlob(new Blob([xmlData]), 'mrplotter-graph.svg');
            });
        }
        wrapper.appendChild(a);
        downloadAnchor.insertAdjacentHTML('beforeBegin', "<div>(created " + (new Date()).toLocaleString() + ", local time)</div>");
        downloadAnchor.insertAdjacentElement('beforeBegin', wrapper);
    };
    image.src = "data:image/svg+xml," + xmlData;
    if(image.complete) imageLoaded();
    else image.addEventListener('load', imageLoaded);


    //IE has issues with the onload event for images so as a backstop
    //I'm running the handler on a setTimeout. If it's already run it will return early
    setTimeout(imageLoaded, 1);
    
    if (!('download' in downloadAnchor)) {
        console.log("No download attribute");
    }


}

function createPermalink(self, return_raw_document) {
    if (self.idata.oldXScale == undefined) {
        return;
    }
    var coerce_stream;
    if (self.find(".includeMetadata").checked) {
        coerce_stream = function (stream) { return JSON.parse(JSON.stringify(stream)); };
    } else {
        coerce_stream = function (stream) { return stream.uuid; };
    }
    var domain = self.idata.oldXScale.domain();
    var streams = [];
    var permalink = {
            streams: self.idata.selectedStreams.map(function (d) { return { stream: coerce_stream(d), color: self.idata.streamSettings[d.uuid].color, selected: self.idata.showingDensity == d.uuid }; }),
            resetStart: Number(self.idata.oldStartDate.toString() + '000000'),
            resetEnd: Number(self.idata.oldEndDate.toString() + '000000'),
            tz: self.idata.oldTimezone,
            dst: self.idata.oldDST,
            start: Number((domain[0].getTime() - self.idata.offset).toString() + '000000'),
            end: Number((domain[1].getTime() - self.idata.offset).toString() + '000000'),
            autoupdate: self.idata.automaticAxisUpdate,
            axes: $.map(self.idata.yAxes, function (d) {
                    return {
                            axisname: d.truename,
                            streams: $.map(d.streams, function (s) { return s.uuid; }),
                            scale: d.manualscale,
                            rightside: d.right
                        };
                })
        };
    if (self.idata.vertCursor1) {
        permalink.vertCursor1 = self.idata.vertCursor1.coord / self.idata.WIDTH;
    }
    if (self.idata.vertCursor2) {
        permalink.vertCursor2 = self.idata.vertCursor2.coord / self.idata.WIDTH;
    }
    if (self.idata.horizCursor1) {
        permalink.horizCursor1 = 1 - self.idata.horizCursor1.coord / self.idata.HEIGHT;
    }
    if (self.idata.horizCursor2) {
        permalink.horizCursor2 = 1 - self.idata.horizCursor2.coord / self.idata.HEIGHT;
    }
    if (return_raw_document) {
        return permalink;
    }

    var permalocation = self.find(".permalink");
    permalocation.innerHTML = 'Generating permalink...';

    self.requester.makePermalinkInsertRequest(permalink, function (result) {
            var id = result;
            var URL = self.idata.initPermalink + id;
            var anchor = document.createElement("input");
            anchor.value = URL;
            anchor.setAttribute("style", "width: 100%;");
            anchor.setAttribute("id", "copy_contents");
            anchor.setAttribute("onclick", 'copyToClipboard("copy_contents")');
            anchor.setAttribute("onfocus", 'this.select();');
            anchor.setAttribute("onmouseup", 'return false;');
            permalocation.innerHTML = "";
            permalocation.insertBefore(anchor, null);
            self.idata.loadedPermalink = true;
        }, function (error) {
            console.log(error);
            permalocation.innerHTML = 'Permalink could not be generated.';
        });

    return true;
}

// Currently not being used because the PSL UI assumes a 'windows' type query
function getCSVQueryType(self) {
    if ($(self.find(".csv-querytype-aligned")).hasClass("active")) {
        return "aligned";
    } else if ($(self.find(".csv-querytype-windows")).hasClass("active")) {
        return "windows";
    } else if ($(self.find(".csv-querytype-raw")).hasClass("active")) {
        return "raw";
    } else {
        throw "No query type is selected";
    }
}

function setPWSelectorValue(self, pwselector, zero) {
    pwselector.value = zero ? 62 : 63 - self.idata.csvpwestimate;
    self.find(".csv-windowsize-text").value = Math.pow(2, self.idata.csvpwestimate);
    $(self.find(".csv-unit-option-nanoseconds")).click(); // Select "nanoseconds"
    pwselector.onchange();
}

function buildCSVMenu(self) {
    var settingsObj = {};
    // var queryType = getCSVQueryType(self);
    var graphExport = self.find("div.graphExport");
    var streamsettings = graphExport.querySelector("div.csv-streams");
    $(streamsettings).empty();
    var streams = self.idata.selectedStreams.slice(); // In case the list changes in the meantime
    var update, groups;
    if (streams.length > 0) {
        update = d3.select(streamsettings)
          .selectAll("div")
          .data(streams);
        groups = update.enter()
          .append("div")
            .attr("class", "input-group");

        // HIDDEN STREAM SELECTION
        // groups.append("span")
            // .attr("class", "input-group-btn")
          // .append("div")
            // .attr("class", "btn btn-default active")
            // .attr("data-toggle", "button")
            // .html("Included")
            // .each(function () {
                    // this.onclick = function () {
                            // var streamName = this.parentNode.nextSibling;
                            // if (this.innerHTML == "Included") {
                                // this.innerHTML = "Include Stream";
                                // delete settingsObj[this.__data__.uuid];
                                // streamName.value = s3ui.getFilepath(this.__data__);
                            // } else {
                                // this.innerHTML = "Included";
                                // settingsObj[this.__data__.uuid] = streamName.value;
                            // }
                            // streamName.disabled = !streamName.disabled;
                        // };
                // });

        groups.append("input")
        // TEXT INPUTS HIDDEN
            .attr("type", "hidden")
            .attr("class", "form-control")
            .property("value", function (d) { return s3ui.getFilepath(d); })
            .each(function () {
                    this.onchange = function () {
                            settingsObj[this.__data__.uuid] = this.value;
                        };
                    this.onchange();
                });
        update.exit().remove();
    } else {
        streamsettings.innerHTML = "You must plot streams in your desired time range before you can generate a CSV file.";
    }

    var pwselector = graphExport.querySelector(".windowwidth-selector");
    var pwselectbox = graphExport.querySelector(".resolutions");
    var domain = self.idata.oldXScale;
    var submitButton = graphExport.querySelector("div.csv-button");
    var $submitButton = $(submitButton);
    var textSpace;
    var widthlists = [
      8333333, //half 60hz
      10000000, //half 50hz
      16666666, //full 60hz
      20000000, //full 50hz
      1000000000, //second
      60000000000, //minute
      300000000000, //5 minutes
      1800000000000, //30 minutes
      3600000000000, //hour
      86400000000000 //day
    ];
    if (streams.length > 0 && domain != undefined) {
        domain = domain.domain();
        $(pwselector).css("display", "");

        var exportCSV = self.find('input#export-type-csv');
        var exportJupyter = self.find('input#export-type-jupyter');

        function changeExportType(exportType) {
            var exportFooters = document.querySelectorAll('.modal-footer.export-type');
            // IE is missing forEach on NodeList objects so steal it from the Array Prototype
            Array.prototype.forEach.call(
                exportFooters, 
                function toggleFooterViz(node) {
                    if (node.className.indexOf(exportType) >= 0) {
                        node.style.display = "block";
                    } else {
                        node.style.display = "none";
                    }
                }
            );
        }
        function selectText(el) {
            if (typeof el === "string") {
                //you may also pass in a CSS selector
                el = document.querySelector(el)
            }
            if (!el) {
                console.warn('selectText did not receive a valid element to copy');
                return;
            }
            var doc = window.document, sel, range;
            if (window.getSelection && doc.createRange) {
                sel = window.getSelection();
                range = doc.createRange();
                range.selectNodeContents(el);
                sel.removeAllRanges();
                sel.addRange(range);
            } else if (doc.body.createTextRange) {
                range = doc.body.createTextRange();
                range.moveToElementText(el);
                range.select();
            }
        }
        function copyToClipboard(el) {
            selectText(el);
            document.execCommand("Copy");
        }
        function updateCSVoptionsHTML() {
            var csvOptions = prepareCSVDownloadOptions(
                self, streams, settingsObj, domain, widthlists[parseInt(pwselectbox.value)], graphExport
            );
            var csvOptionCodeBlockEl = self.find('code.csvJsonObject');
            csvOptionCodeBlockEl.innerHTML = "\n" +
                "opts_dict = " + JSON.stringify(csvOptions, null, 4) + "\n\n" +
                "domain = \"" + window.location.protocol + "//" + self.backend + "\"";
            selectText(document.querySelector('.export-jupyter pre'));
        }
        var resolutionSelect = document.querySelector('select.resolutions');
        resolutionSelect.addEventListener('change', updateCSVoptionsHTML, false);
        exportCSV.onchange = function chooseCSV() { changeExportType('export-csv'); }
        exportJupyter.onchange = function chooseJupyter() {
            changeExportType('export-jupyter');
            updateCSVoptionsHTML();
        }
        var copyCodeButton = document.querySelector('#copyJupyterCode');

        copyCodeButton.addEventListener('click', copyToClipboard.bind(null, '.export-jupyter pre'));
        pwselector.onchange = function () {
                var wt = widthlists[this.value];
                var m1 = this.nextSibling.nextSibling;
                //m1.innerHTML = "Window width: "+widthdesc[this.value];
                var pps = Math.ceil(1000000 * (domain[1] - domain[0]) / wt);
                var statusString = "(Your data will contain " + pps + (pps == 1 ? "row)" : " rows)");
                if (pps > 100000) {
                   $submitButton.addClass("disabled")
                   statusString += "<br><strong>(Too many to download - choose a longer time per data point)</strong>"
                } else {
                   $submitButton.removeClass("disabled")
                }
            };
        pwselectbox.onchange = function () {
                var wt = widthlists[this.value];
                var m1 = this.nextSibling.nextSibling.nextSibling.nextSibling;
                //m1.innerHTML = "Window width: "+widthdesc[this.value];
                var pps = Math.ceil(1000000 * (domain[1] - domain[0]) / wt);
                var statusString = "(Your data will contain " + pps + (pps == 1 ? "row)" : " rows)");
                if (pps > 100000) {
                   $submitButton.addClass("disabled")
                   statusString += "<br><strong>(Too many to download - choose a longer time per data point)</strong>"
                } else {
                   $submitButton.removeClass("disabled")
                }
                m1.nextSibling.nextSibling.innerHTML = statusString;
            };

        //pwselector.value = self.idata.oldData[streams[0].uuid][2];
        //pwselectbox.value = self.idata.oldData[streams[0].uuid][2];
        //pwselector.onchange();
        pwselectbox.onchange();

        submitButton.onclick = function () {
                createCSVDownload(self, streams, settingsObj, domain, widthlists[parseInt(pwselectbox.value)], graphExport);
            };
    } else {
        $(pwselectortl).css("display", "none");
        textSpace = pwselectortl.nextSibling.nextSibling;
        textSpace.innerHTML = "";
        textSpace.nextSibling.nextSibling.innerHTML = "";
        submitButton.onclick = function () { return false; };
    }
}

function prepareCSVDownloadOptions(self, streams, settingsObj, domain, wt, graphExport) {
    streamUUIDs = streams.filter(function (x) { return settingsObj.hasOwnProperty(x.uuid); }).map(function (x) { return x.uuid; });
    var dataJSON = {
        "StartTime": domain[0] - self.idata.offset,
        "EndTime": domain[1] - self.idata.offset,
        "UUIDS": streamUUIDs,
        "Labels": streamUUIDs.map(function (x) { return settingsObj[x].replace(/\/\s/g, "/") }),
        "QueryType":  "windows", //getCSVQueryType(self),
        "WindowText": wt.toString(), // self.find(".csv-windowsize-text").value,
        "WindowUnit": "nanoseconds", // self.find(".csv-unit-current").innerHTML,
        "UnitofTime": "ms",
        // if omitted the backend assumes a PointWidth of zero for a Windows query
        "PointWidth": 0, // pwe, 
        "_token": self.requester.getToken()
    };
    return dataJSON;
}

function createCSVDownload(self, streams, settingsObj, domain, wt, graphExport) {
    var dataJSON = prepareCSVDownloadOptions(self, streams, settingsObj, domain, wt, graphExport);
    var csvform = graphExport.querySelector(".csv-form");
    csvform.querySelector(".csv-form-data").value = JSON.stringify(dataJSON);
    csvform.submit();
}

function login(self) {
    var loginElem = self.find(".logindiv");
    var usernamefield = loginElem.querySelector(".username");
    var passwordfield = loginElem.querySelector(".password");
    var username = usernamefield.value;
    var password = passwordfield.value;
    usernamefield.value = "";
    passwordfield.value = "";

    var $loginButton = $(loginElem.querySelector(".loginMenu"));
    var loginmessage = loginElem.querySelector(".loginmessage");

    setButtonEnabled($loginButton, false);
    setLoginText(self, "Logging in...");
    self.requester.makeLoginRequest(username, password, function (token) {
            setButtonEnabled($loginButton, true);
            if (token === "" || token === " ") {
                if (token === "") {
                    loginmessage.innerHTML = "Invalid username or password";
                } else {
                    loginmessage.innerHTML = "Server error"
                }
                restoreLoginText(self);
                $loginButton.dropdown("toggle");
            } else {
                loggedin(self, username, token);
                s3ui.updateStreamTree(self);
                var $loginList = $(loginElem.querySelector(".loginList"));
                $loginList.find(".loginstate-start").hide();
                $loginList.find(".loginstate-loggedin").show();
            }
        }, function (error) {
            loginmessage.innerHTML = "Could not contact server; check Internet connection";
            restoreLoginText(self);
            setButtonEnabled($loginButton, true);
            $loginButton.dropdown("toggle");
        });
}

function loggedin(self, username, token) {
    // Creating cookie
    setCookie(self, username, token); // Create cookie, or renew it if it's already there
    self.requester.setToken(token);
    /* This is pathological, but what if someone' username is <script> ... </script>?
     * This probably is only going to be a concern if sometime we add the capability
     * to create an account on the website... but it's still good measure to sanitize
     * the username.
     */
    setLoginText(self, "Logged in as " + s3ui.escapeHTMLEntities(username) + " ");
}

function logoff(self) {
    self.requester.makeLogoffRequest(function () {});
    delCookie(self);
    self.requester.setToken("");
    s3ui.updateStreamTree(self);
    var $loginList = $(self.find(".loginList"));
    $loginList.find(".loginstate-loggedin").hide();
    $loginList.find(".loginstate-start").show();
    setLoginText(self, self.idata.defaultLoginMenuText);
}

function showChangepwMenu(self) {
    var $loginList = $(self.find(".loginList"));
    $loginList.find(".loginstate-loggedin").hide();
    $loginList.find(".loginstate-changepw").show();
    self.idata.changingpw = true;
}

function hideChangepwMenu(self) {
    var $loginList = $(self.find(".loginList"));
    $loginList.find(".loginstate-changepw").hide();
    $loginList.find(".loginstate-loggedin").show();
    self.idata.changingpw = false;
}

function changepw(self, event) {
    var loginElem = self.find(".logindiv");
    var newpasswordfield1 = loginElem.querySelector(".newpassword1");
    var newpasswordfield2 = loginElem.querySelector(".newpassword2");

    var loginmessage = loginElem.querySelector(".loginmessage");

    if (newpasswordfield1.value !== newpasswordfield2.value) {
        loginmessage.innerHTML = "New passwords do not match";
        event.stopPropagation(); // keep the dropdown from closing
        return;
    }

    var oldpasswordfield = loginElem.querySelector(".oldpassword");

    var oldpassword = oldpasswordfield.value;
    var newpassword = newpasswordfield1.value;

    oldpasswordfield.value = "";
    newpasswordfield1.value = "";
    newpasswordfield2.value = "";

    var $loginButton = $(loginElem.querySelector(".loginMenu"));
    var loginmessage = loginElem.querySelector(".loginmessage");

    var errorfunc = function () {
            loginmessage.innerHTML = "A server error has occurred";
            showChangepwMenu(self);
        };

    setButtonEnabled($loginButton, false);
    setLoginText(self, "Changing password...");
    self.requester.makeChangePasswordRequest(oldpassword, newpassword, function (response) {
            restoreLoginText(self);
            setButtonEnabled($loginButton, true);
            if (response === "Success") {
                loginmessage.innerHTML = "Sucessfully changed password";
                $loginButton.dropdown("toggle");
            } else if (response === s3ui.ERROR_INVALID_TOKEN) {
                sessionExpired(self);
                return;
            } else if (response === "Incorrect password") {
                loginmessage.innerHTML = "Current password is incorrect";
                showChangepwMenu(self);
            } else {
                errorfunc();
            }
            $loginButton.dropdown("toggle");
        }, function (error) {
            restoreLoginText(self);
            setButtonEnabled($loginButton, true);
            errorfunc();
            $loginButton.dropdown("toggle");
        });
}

function sessionExpired(self) {
    if (self.requester.getToken() !== "") {
        var loginElem = self.find(".logindiv");
        var $loginButton = $(loginElem.querySelector(".loginMenu"));
        var loginmessage = loginElem.querySelector(".loginmessage");
        loginmessage.innerHTML = "Session expired";
        logoff(self);
        $loginButton.dropdown("toggle");
    }
}

function setButtonEnabled($button, enable) {
    if (enable) {
        $button.removeClass("disabled");
    } else {
        $button.addClass("disabled");
    }
}

function restoreLoginText(self) {
    self.find(".loginButtonText").innerHTML = self.idata.prevLoginMenuText;
}

function setLoginText(self, text) {
    var loginMenuText = self.find(".loginButtonText");
    self.idata.prevLoginMenuText = loginMenuText.innerHTML;
    loginMenuText.innerHTML = text;
}

function getCookie(self) {
    var usernamekey = self.cookiekey + "_username";
    var tokenkey = self.cookiekey + "_token";
    if (window.localStorage === undefined) {
        var cookiestr = document.cookie;
        var username = cookieGetKV(cookiestr, usernamekey);
        var token = cookieGetKV(cookiestr, tokenkey);
        return [username, token];
    } else {
        return [window.localStorage.getItem(usernamekey), window.localStorage.getItem(tokenkey)];
    }
}

function setCookie(self, username, token) {
    var expiry;
    if (window.localStorage === undefined) {
        expiry = new Date();
        var currTime = expiry.getTime();
        expiry.setTime(currTime + 14 * 24 * 60 * 60 * 1000);
    }
    writeCookie(self, username, token, expiry);
}

function delCookie(self) {
    if (window.localStorage === undefined) {
        writeCookie(self, "", "", new Date(0));
    } else {
        window.localStorage.removeItem(self.cookiekey + "_username");
        window.localStorage.removeItem(self.cookiekey + "_token");
    }
}

function cookieGetKV(cookiestr, key) {
    var keyindex = cookiestr.indexOf(key + "=");
    if (keyindex == -1) {
        return null;
    }
    var valstart = keyindex + key.length + 1;
    var valend = cookiestr.indexOf(";", valstart);
    if (valend == -1) {
        valend = cookiestr.length;
    }
    return cookiestr.substring(valstart, valend);
}

function writeCookie(self, username, token, expiry) {
    var usernamekey = self.cookiekey + "_username";
    var tokenkey = self.cookiekey + "_token";
    if (window.localStorage === undefined) {
        var suffix = "; domain=" + window.location.hostname + "; path=/; secure; expires=" + expiry.toUTCString() + ";"
        document.cookie = usernamekey + "=" + username + suffix;
        document.cookie = tokenkey + "=" + token + suffix;
    } else {
        window.localStorage.setItem(usernamekey, username);
        window.localStorage.setItem(tokenkey, token);
    }
}

function checkCookie(self, callback) {
    var cookiedata = getCookie(self);
    var username = cookiedata[0];
    var token = cookiedata[1];
    var $button = $(self.find(".loginMenu"));
    setButtonEnabled($button, false);
    if (username !== null && token !== null) {
        self.requester.makeCheckTokenRequest(token, function (response) {
                setButtonEnabled($button, true);
                if (response === "ok") {
                    callback(username, token);
                } else {
                    callback(null, null);
                }
            }, function (error) {
                setButtonEnabled($button, true);
                callback(null, null);
            });
    } else {
        setTimeout(function () {
                setButtonEnabled($button, true);
                callback(null, null);
            }, 0);
    }
}

s3ui.init_frontend = init_frontend;
s3ui.toggleLegend = toggleLegend;
s3ui.setStreamMessage = setStreamMessage;
s3ui.updatePlotMessage = updatePlotMessage;
s3ui.getSelectedTimezone = getSelectedTimezone;
s3ui.createPlotDownload = createPlotDownload;
s3ui.createPermalink = createPermalink;
s3ui.buildCSVMenu = buildCSVMenu;
s3ui.login = login;
s3ui.loggedin = loggedin;
s3ui.logoff = logoff;
s3ui.showChangepwMenu = showChangepwMenu;
s3ui.hideChangepwMenu = hideChangepwMenu;
s3ui.changepw = changepw;
s3ui.sessionExpired = sessionExpired;
s3ui.setLoginText = setLoginText;
s3ui.checkCookie = checkCookie;
