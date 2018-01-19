class ProcessFlow {
    constructor({
        height = 1000,
        width = 1000,
        data,
        enableZoom = true,
        enableDrag = true,
        rectHeight = 50,
        rectWidth = 100,
        squareSize = 30,
        circleSize = 20,
    }) {
        this.svgHeight = height;
        this.svgWidth = width;
        this.data = data;
        this.enableZoom = enableZoom;
        this.enableDrag = enableDrag;
        this.rectHeight = rectHeight;
        this.rectWidth = rectWidth;
        this.squareSize = squareSize;
        this.circleSize = circleSize;
    }

    draw() {
        this._drawSvgContainer()
        this._drawMarker(this.data.links)
        this._drawLinks(this.data.links)
        this._drawNodes(this.data.nodes)
    }

    _drawSvgContainer() {
        const zoom = d3.zoom()
            .scaleExtent([0.5, 2])
            .on("zoom", this.zoomed);
        let svg = d3.select("body")
            .append("svg")
            .attr("width", this.svgWidth)
            .attr("height", this.svgHeight)
            .append("g")
            .attr("class", "container")
            .call(zoom);
    }
    zoomed() {
        d3.select(".container")
            .attr("transform", d3.event.transform);
    }
    _drawMarker(data) {
        let marker = d3.select("svg").selectAll('marker').data(data)
        marker.exit().remove()
        marker.enter().append('svg:marker')
            .attr('id', d => 'marker_' + d.marker.type + "_" + d.index)
            .attr('markerHeight', d => d.marker.markerHeight)
            .attr('markerWidth', d => d.marker.markerWidth)
            .attr('markerUnits', 'strokeWidth')
            .attr('orient', d => d.marker.orient)
            .attr('refX', d => d.marker.refX ? d.marker.refX : this._calculateArrowOffset(d.source, d.target, d.target.rw, d.target.rh))
            .attr('refY', d => d.marker.refY)
            .attr('viewBox', d => d.marker.viewbox)
            .append('svg:path')
            .attr('d', d => d.marker.path)
            .attr('fill', d => d.marker.color);

    }
    _drawLinks(links) {
        let svg = d3.select("body").select("svg").select("g");
        let linksPath = svg.selectAll(".link").data(links)
            //operate on new elements only
            .enter().append("path")
            .style("fill", "none")
            .attr("class", "link")
            .attr("d", function(d) {
                if (d.polyLine) {
                    return d3.line()
                        .x(function(d) { return d.x })
                        .y(function(d) { return d.y })
                        .curve(d3.curveStepBefore)([d.source, d.target])
                } else {
                    return d3.line()
                        .x(function(d) { return d.x })
                        .y(function(d) { return d.y })
                        .curve(d3.curveLinear)([d.source, d.target])
                }
            })
            .style("stroke", "#787878")
            .style("storke-width", "1px")
            .attr("marker-end", function(d) { return "url(#marker_" + d.target.type + "_" + d.index + ")" });;
    }
    _drawNodes(data) {
        var svg = d3.select("body").select("svg").select("g");
        var nodes = svg.selectAll(".node")
            .data(data)
            .enter()
            .append("g")
            .attr("class", "node-group")
            .on("click", this.handlerClick);

        nodes.append("title")
            .text(d => d.text);
        nodes
            .filter(function(d) { return d.type === "circle"; })
            .append("circle")
            .attr("class", "node")
            .attr("r", function(d) {
                return d.r
            })
            .attr("cx", function(d) {
                return d.x;
            })
            .attr("cy", function(d) {
                return d.y;
            })
            .style("stroke", d => d.colorBorder ? d.colorBorder : "black")
            .style("stroke-width", "2px")
            .style("fill", function(d) {
                return d.colorBg ? d.colorBg : "red";
            })

        nodes
            .filter(function(d) { return d.type === "diamond"; })
            .append("path")
            .attr("class", "node diamond")
            .attr('d', d3.symbol()
                .size(function(d) { return d.size; })
                .type(function(d, i) { return d3.symbolDiamond; }))
            .style("fill", d => d.colorBg ? d.colorBg : "red")
            // .style("fill", "none")
            .style("stroke", d => d.colorBorder ? d.colorBorder : "black")
            .style("stroke-width", "2px")
            .attr("transform", d => "translate(" + d.x + "," + d.y + ")")
            // .attr("transform", function(d, i) { return "translate(-" + d.rw / 2 + ",-" + d.rh / 2 + ")"; })
            // .on("click", this.handlerClick);

        nodes
            .filter(function(d) { return d.type === "rect"; })
            .append("rect")
            .attr("class", "node")
            .attr("x", d => d.x)
            .attr("y", d => d.y)
            .attr("rx", d => d.rx)
            .attr("ry", d => d.ry)
            .attr("width", d => d.rw)
            .attr("height", d => d.rh)
            .attr("transform", function(d, i) { return "translate(-" + d.rw / 2 + ",-" + d.rh / 2 + ")"; })
            .style("fill", function(d) {
                return d.colorBg ? d.colorBg : "white";
            })
            .style("stroke", d => d.colorBorder ? d.colorBorder : "#4e4e4e")
            .style("stroke-width", "1px")
            // .on("click", this.handlerClick)

        this._drawTest(nodes).call(d3.drag()
            .on("start", this.dragstart)
            .on("drag", this.dragged.bind(this))
            .on("end", this.dragend));


    }
    _drawTest(oNode) {

        oNode.filter(function(d) { return d.type === "rect"; }).append("text").attr("x", function(d) {
                return d.x;
            })
            .attr("y", function(d) {
                return d.y;
            })
            .attr("text-anchor", "middle")
            .attr("textLength", function(d) {
                return d.r ? d.r * 2 : d.rw;
            })
            .attr("class", "text")
            .attr("fill", d=>d.colorFont ? d.colorFont : "#939392")
            .attr("alignment-baseline", "middle")
            .text(d => _.truncate(d.text, { length: 20 }));
        oNode.filter(function(d) { return d.type === "circle"; }).append("text").attr("x", function(d) {
                return d.x;
            })
            .attr("y", function(d) {
                return d.y;
            })
            .attr("text-anchor", "middle")
            .attr("textLength", function(d) {
                return d.r ? d.r * 2 : d.rw;
            })
            .attr("fill", d=>d.colorFont ? d.colorFont : "red")
            .attr("class", "text")
            .attr("alignment-baseline", "middle")
            .text(d => _.truncate(d.text, { length: 10 }));

        return oNode;
    }

    handlerClick(d, i) {
        // d3.selectAll(".node").style("stroke", "black")
        //select the second child of selected g  .
        let selectBefore = d3.selectAll(".selected");
        if(!selectBefore.empty()){
        	
        selectBefore.classed("selected",false);
           //回退之前的stoke
        selectBefore.style("stroke",selectBefore.attr("selected"));
        }

        let selectedNow = d3.select(this).select(":nth-child(2)");
     
        selectedNow.classed("selected",true);
         //保存当前的stoke
      	selectedNow.attr("selected",selectedNow.style("stroke"));
      	selectedNow.style("stroke","yellow")
        alert("This is " + d.text)
    }

    dragstart() {

    }
    dragend() {

    }

    dragged(d) {
        d.x = d3.event.x;
        d.y = d3.event.y;
        // 重新绘制当前节点以及相关的链路位置即可
        var nodeGroup = d3.selectAll(".node-group").filter(function(v, i) {
            if (v.id === d.id) {
                return true;
            }
        });
        var node = nodeGroup.select(".node");
        if (node.data()[0].type === "rect") {
            node.attr("x", function(d, i) { return d.x; })
                .attr("y", function(d, i) { return d.y; })
        } else if (node.data()[0].type === "circle") {
            node.attr("cx", function(d, i) { console.log(d); return d.x; })
                .attr("cy", function(d, i) { return d.y; });
        } else {
            node.attr("transform", d => "translate(" + d.x + "," + d.y + ")")
        }


        var link = d3.selectAll(".link").filter(function(v, i) {
            if (v.source.id == d.id || v.target.id == d.id) {
                return true;
            }
        });
        link.attr("d", function(d) {
            if (d.polyLine) {

                return d3.line()
                    .x(function(d) { return d.x })
                    .y(function(d) { return d.y })
                    .curve(d3.curveStepBefore)([d.source, d.target])
            } else {

                var x1 = d.source.x;
                var y1 = d.source.y;
                var x2 = d.target.x;
                var y2 = d.target.y;

                return "M" + x1 + " " + y1 + "L" + x2 + " " + y2;
            }
        });
        //update marker
        var marker = d3.selectAll("marker").filter(function(v, i) {
            if (v.target.id === d.id || v.source.id === d.id) {
                return true;
            }
        });
        marker
            .attr('refX', d => d.marker.refX ? d.marker.refX : this._calculateArrowOffset(d.source, d.target, d.target.rw, d.target.rh))
            .attr('refY', function(d) { return d.marker.refY })


        //update text
        var text = d3.selectAll(".text").filter(function(v, i) {
            if (v.id === d.id) {
                return true;
            }
        });
        text.attr("x", function(d) {
                return d.x;
            })
            .attr("y", function(d) {
                return d.y;
            })
    }

    _calculateArrowOffset(oSourcePoint, oTargetPoint, w, h) {
        var iCellWidth = w,
            iCellHeight = h;

        if (oTargetPoint.x === oSourcePoint.x) {
            return (iCellHeight / 2) + 5;
        } else if (oTargetPoint.y === oSourcePoint.y) {
            return (iCellWidth / 2) + 5;
        } else {
            var fPointDistance = this._calculatePointDistance(oSourcePoint, oTargetPoint);

            var fCellSlope = iCellHeight / iCellWidth;
            var fLinkSlope = Math.abs((oTargetPoint.y - oSourcePoint.y) / (oTargetPoint.x - oSourcePoint.x));
            if (fLinkSlope < fCellSlope) {
                return (iCellWidth * fPointDistance / (Math.abs(oSourcePoint.x - oTargetPoint.x) * 2)) + 5;
            } else {
                return (iCellHeight * fPointDistance / (Math.abs(oSourcePoint.y - oTargetPoint.y) * 2)) + 5;
            }
        }
    }

    _calculatePointDistance(oPoint1, oPoint2) {
        var dx = oPoint1.x - oPoint2.x,
            dy = oPoint1.y - oPoint2.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

}