/*!
 * ${copyright}
 */
/* global _:true */
sap.ui.define(["jquery.sap.global", "./../library", "sap/ui/core/Control", "sap/ui/thirdparty/d3"],
	function(jQuery, library, Control) {
		"use strict";
		/**
		 * Status Model Preview.
		 *
		 * @class Visualization of status transitions within status model.
		 * @extends sap.ui.core.Control
		 * @author C5259666
		 * @public
		 * @version ${version}
		 */
		var StatusModelPreview = Control.extend("sap.ems.ui.control.StatusModelPreview", {
			metadata: {
				library: "sap.ems.ui",
				properties: {
					cellWidth: {
						type: "int",
						defaultValue: 145
					},
					cellHeight: {
						type: "int",
						defaultValue: 45
					},
					arrowWidth: {
						type: "int",
						defaultValue: 10
					},
					arrowHeight: {
						type: "int",
						defaultValue: 10
					},
					selfLinkCircleRadius: {
						type: "int",
						defaultValue: 40
					},
					selfLinkCircleOffset: {
						type: "int",
						defaultValue: 90
					},
					// show this message when no node
					noData: {
						type: "string",
						defaultValue: "No entries were found."
					},
					// enable pin via right-click
					pin: {
						type: "boolean",
						defaultValue: false
					},
					// whether pin node when added
					pinAddedNode: {
						type: "boolean",
						defaultValue: true
					},
					// whether to show pin icon
					pinIcon: {
						type: "boolean",
						defaultValue: true
					},
					// enable zoom
					zoom: {
						type: "boolean",
						defaultValue: true
					},
					// enable drag
					drag: {
						type: "boolean",
						defaultValue: false
					},
					// enable highlight
					highlight: {
						type: "boolean",
						defaultValue: true
					}
				}
			},
			setStatusModel: function(oStatusModel) {
				oStatusModel.attachPropertyChange(function() {
					this._delayedDraw(false);
				}, this);
				oStatusModel.attachRequestCompleted(function() {
					this._delayedDraw(true);
				}, this);
				this._statusModel = oStatusModel;
				this._delayedDraw(true);
			},
			setStyles: function(aStyle) {
				if (aStyle) {
					this._aStyle = aStyle;
					if (this._oForce) {
						this._oForce.start();
					}
				}
			},
			getSettings: function() {
				var oSettings = {};
				// node positions
				if (this._oForce) {
					var aSize = this._getSvgSize(),
						iWidth = aSize[0],
						iHeight = aSize[1];
					oSettings.layout = _.map(this._oForce.nodes(), function(oNode) {
						var node = _.pick(oNode, ["guid", "x", "y", "fixed"]);
						node.x = _.round(node.x / iWidth, 3);
						node.y = _.round(node.y / iHeight, 3);
						return node;
					});
				} else {
					oSettings.layout = [];
				}
				// zoom scale
				if (this._oZoom) {
					oSettings.scale = this._oZoom.scale();
				}
				return oSettings;
			},
			init: function() {},
			renderer: function(oRM, oControl) {
				oRM.write("<div");
				oRM.writeControlData(oControl);
				oRM.addClass("status-model-previewer");
				oRM.writeClasses();
				oRM.write(">");
				oRM.write("</div>");
			},
			onAfterRendering: function() {
				this._delayedDraw();
			},
			_getSvgSize: function() {
				var iWidth = jQuery(this.getDomRef()).width(); // container should have a width.
				var iHeight = Math.floor(iWidth * 0.5);
				return [iWidth, iHeight];
			},
			_getNodes: function(bInitialDraw) {
				var aTransitions = this._statusModel.getProperty("/transitionList").slice();
				// count in initial status
				aTransitions.push({
					currentStatus: this._statusModel.getProperty("/initialStatus"),
					nextStatus: {}
				});
				// pull nodes
				var aNodes = _.chain(aTransitions)
					.flatMap(function(oTransition) {
						var aStatus = [];
						if (oTransition.currentStatus.guid) {
							aStatus.push(oTransition.currentStatus);
						}
						if (oTransition.nextStatus.guid) {
							aStatus.push(oTransition.nextStatus);
						}
						return aStatus;
					})
					.uniqBy("guid")
					.cloneDeep()
					.value();
				if (bInitialDraw) {
					// first draw, restore layout settings
					this._restoreNodePositionSettings(aNodes);
				} else {
					// maintain the node state when 2nd 3rd ... draw
					aNodes.forEach(function(oNode) {
						var oExistingNode = _.find(this._aNodes, function(node) {
							return node.guid === oNode.guid;
						});
						_.defaultsDeep(oNode, oExistingNode);
					}, this);
				}

				if (!bInitialDraw) {
					// pin added nodes when they are relative stable.
					this._pinAddedNodes(aNodes, this._aNodes);
				}

				this._aNodes = aNodes;
				return aNodes;
			},
			_restoreNodePositionSettings: function(aNodes) {
				var sPreviewSettings = this._statusModel.getProperty("/previewLayout");
				if (sPreviewSettings) {
					var aLayoutSettings = JSON.parse(sPreviewSettings).layout;
					var aSize = this._getSvgSize(),
						iWidth = aSize[0],
						iHeight = aSize[1];
					aNodes.forEach(function(oNode) {
						var oSetting = _.find(aLayoutSettings, {
							guid: oNode.guid
						});
						if (oSetting) {
							oSetting.x = iWidth * oSetting.x;
							oSetting.y = iHeight * oSetting.y;
							_.assign(oNode, oSetting);
							this._setNodePinned(oNode, oSetting.fixed);
						}
					}, this);
				}
			},
			_pinAddedNodes: function(aNewNodes, aOldNodes) {
				if (this.getPinAddedNode()) {
					var aAddedNodes = _.differenceBy(aNewNodes, aOldNodes, "guid");
					var that = this;
					jQuery.sap.delayedCall(1000, that, function() {
						var aMatched = _.intersectionBy(that._aNodes, aAddedNodes, "guid");
						if (aMatched && aMatched.length > 0) {
							_.each(aMatched, function(oNode) {
								that._setNodePinned(oNode, true);
							});
							that._setNodesToVisible(aMatched);
						}
					});
				}
			},
			_setNodesToVisible: function(aNodes) {
				var oVisibleArea = this._getVisibleArea();
				_.each(aNodes, function(oNode) {
					oNode.x = _.min([_.max([oNode.x, oVisibleArea.xMin]), oVisibleArea.xMax]);
					oNode.y = _.min([_.max([oNode.y, oVisibleArea.yMin]), oVisibleArea.yMax]);
					oNode.px = oNode.x;
					oNode.py = oNode.y;
				});
			},
			_getVisibleArea: function() {
				var fScale = this._oZoom.scale(),
					aTranslate = this._getTranslate(fScale),
					iTransX = aTranslate[0],
					iTransY = aTranslate[1],
					aSvgSize = this._getSvgSize(),
					iWidth = aSvgSize[0],
					iHeight = aSvgSize[1];
				var iMinX = -iTransX,
					iMaxX = iWidth + iTransX,
					iMinY = -iTransY,
					iMaxY = iHeight + iTransY;
				return {
					xMin: iMinX,
					xMax: iMaxX,
					yMin: iMinY,
					yMax: iMaxY
				};
			},
			_getTranslate: function(fScale) {
				var aSvgSize = this._getSvgSize(),
					iSvgWidth = aSvgSize[0],
					iSvgHeight = aSvgSize[1];
				return [
					(fScale - 1) * iSvgWidth * -0.5,
					(fScale - 1) * iSvgHeight * -0.5
				];
			},
			_getLinks: function(aNodes) {
				var aTransitions = this._statusModel.getProperty("/transitionList").filter(function(oTransition) {
					return oTransition.currentStatus.guid && oTransition.nextStatus.guid;
				});
				var fnCheckGuid = _.curry(function(oTransition, sTransitionProperty, oStatus) {
					return oTransition[sTransitionProperty].guid === oStatus.guid;
				});
				return _.map(aTransitions, function(oTransition) {
					var iSourceIndex = _.findIndex(aNodes, fnCheckGuid(oTransition, "currentStatus"));
					var iTargetIndex = _.findIndex(aNodes, fnCheckGuid(oTransition, "nextStatus"));
					return {
						source: iSourceIndex,
						target: iTargetIndex,
						description: oTransition.description
					};
				});
			},
			_createForceLayout: function(aNodes, aLinks) {
				if (!this._oForce) {
					this._oForce = d3.layout.force()
						.linkDistance(300); //TODO: good to have dynamic link distance. But when using dynamic link distance the layout is not good, chart is not in center.
				}
				var aSvgSize = this._getSvgSize();
				this._oForce.size(aSvgSize);

				if (aNodes.length > 0) {
					this._oForce
						.nodes(aNodes)
						.links(aLinks);
				}
				this._oForce.start();

				return this._oForce;
			},
			_createSvgElements: function() {
				var aSvgSize = this._getSvgSize();

				var oSvg = d3.select(this.getDomRef()).selectAll("svg")
					.data([1]);
				oSvg.enter().append("svg");
				oSvg
					.attr("width", aSvgSize[0])
					.attr("height", aSvgSize[1]);

				if (oSvg.size() > 0) {
					// Cannot set namespace attribute in d3 way
					// refer to https://github.com/d3/d3/issues/1935
					oSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns", "http://www.w3.org/2000/svg");
					oSvg.node().setAttributeNS("http://www.w3.org/2000/xmlns/", "xmlns:xlink", "http://www.w3.org/1999/xlink");
				}

				oSvg.selectAll("g").data([1]).enter().append("g");
				return oSvg;
			},
			_zoom: function(fDelta) {
				var oGroupSvg = d3.select(this.getDomRef()).select("g");
				var oZoom = this._oZoom,
					aExtent = oZoom.scaleExtent(),
					fOldScale = oZoom.scale(),
					fNewScale = fOldScale + fDelta;
				if (_.inRange(fNewScale, aExtent[0], aExtent[1])) {
					oZoom
						.scale(fNewScale)
						.translate(this._getTranslate(fNewScale))
						.event(oGroupSvg);
					return true;
				} else {
					return false;
				}
			},
			_enableZoom: function(oGroupSvg, oForce) {
				var that = this;
				var aSvgSize = this._getSvgSize(),
					iSvgWidth = aSvgSize[0],
					iSvgHeight = aSvgSize[1];
				var oZoom = d3.behavior.zoom()
					.center([iSvgWidth / 2, iSvgHeight / 2])
					.scaleExtent([0.5, 2])
					.on("zoom", function() {
						if (that.getZoom()) {
							var aTranslate = that._getTranslate(d3.event.scale);
							oGroupSvg.attr("transform",
								"translate(" + aTranslate + ")scale(" + d3.event.scale + ")");
						}
					});

				if (this._oZoom) {
					oZoom.scale(this._oZoom.scale());
				}

				this._oZoom = oZoom;

				oGroupSvg.call(oZoom)
					.on("dblclick.zoom", null); // To disable double click zoom.

				oGroupSvg.selectAll(".status-cell,.status-name,.status-code")
					.call(oForce.drag()
						.on("dragstart", function(d) {
							// To prevent shaking when drag
							// https://stackoverflow.com/questions/17953106/why-does-d3-js-v3-break-my-force-graph-when-implementing-zooming-when-v2-doesnt
							d3.event.sourceEvent.stopPropagation();
						}));
			},
			_restoreZoomSettings: function() {
				var sPreviewSettings = this._statusModel.getProperty("/previewLayout");
				if (sPreviewSettings) {
					var fScale = JSON.parse(sPreviewSettings).scale;
					if (!fScale) {
						fScale = 1;
					}
					var aTranslate = this._getTranslate(fScale),
						oGroupSvg = d3.select(this.getDomRef()).select("g");
					this._oZoom
						.scale(fScale)
						.translate(aTranslate)
						.event(oGroupSvg);
				}
			},
			_enableHightlight: function(oGroupSvg) {
				var that = this;
				oGroupSvg.selectAll(".status-cell,.status-name,.status-code")
					.on("dblclick", function(d) {
						that._toggleHighlight(d, this);
					});
			},
			_enablePin: function(oGroupSvg, oForce) {
				var that = this;
				oGroupSvg.selectAll(".status-cell,.status-name,.status-code")
					.on("contextmenu", function(d) {
						that._setNodePinned(d, !d.fixed);
						d3.event.preventDefault();
						oForce.start();
					});
			},
			_disableDrag: function(oGroupSvg) {
				oGroupSvg
					.on("mousedown.zoom", null);
				oGroupSvg.selectAll(".status-cell,.status-name,.status-code")
					.on("mousedown.drag", null);
			},
			_setNodePinned: function(oNode, pinned) {
				oNode.fixed = pinned;
				oNode.statusCellFixed = pinned;
			},
			_showNoData: function(bShow) {
				var oSvg = this._createSvgElements();
				var sMsg = this.getNoData();
				var aNoDataSvg = oSvg.selectAll(".no-data-msg").data(bShow ? [sMsg] : []);
				aNoDataSvg.enter().append("text").attr("class", "no-data-msg")
					.attr("text-anchor", "middle")
					.attr("x", oSvg.attr("width") / 2)
					.attr("y", oSvg.attr("height") / 2)
					.text(function(d) {
						return d;
					});
				aNoDataSvg.exit().remove();
			},
			_delayedDraw: function(bInitialDraw) {
				jQuery.sap.delayedCall(500, this, function() {
					var aSize = this._getSvgSize();
					if (aSize[0] > 0 && aSize[1] > 0) {
						this._draw(bInitialDraw);
					} else {
						this._delayedDraw(bInitialDraw);
					}
				});
			},
			_draw: function(bInitialDraw) {
				if (!this.getDomRef()) {
					// DOM not ready
					return;
				}
				if (!this._statusModel) {
					// status model not ready
					return;
				}

				var aNodes = this._getNodes(bInitialDraw);
				var aLinks = this._getLinks(aNodes);

				this._showNoData(aNodes.length === 0);

				var oForce = this._createForceLayout(aNodes, aLinks);

				var oSvg = this._createSvgElements();
				var oGroupSvg = oSvg.select("g");

				var fnLinksTickHandler = this._drawLinks(oGroupSvg, aLinks);
				var fnCellsTickHandler = this._drawCells(oGroupSvg, aNodes, oForce);
				var fnNamesTickHandler = this._drawNames(oGroupSvg, aNodes);
				var fnCodesTickHandler = this._drawCodes(oGroupSvg, aNodes);
				var fnArrowsTickHandler = this._drawArrows(oGroupSvg, aLinks);
				var fnDescriptionsTickHandler = this._drawDescriptions(oGroupSvg, aLinks);

				this._enableZoom(oGroupSvg, oForce);
				if (bInitialDraw) {
					this._restoreZoomSettings();
				}

				if (this.getHighlight()) {
					this._enableHightlight(oGroupSvg);
				}

				if (this.getPin()) {
					this._enablePin(oGroupSvg, oForce);
				}

				if (!this.getDrag()) {
					this._disableDrag(oGroupSvg);
				}

				var that = this;

				var fnRender = function() {
					fnLinksTickHandler.call(that);
					fnCellsTickHandler.call(that);
					fnNamesTickHandler.call(that);
					fnCodesTickHandler.call(that);
					fnArrowsTickHandler.call(that);
					fnDescriptionsTickHandler.call(that);
				};

				oForce.on("tick", fnRender);
			},
			_getLinksByType: function(aLinks) {
				var aLinksLine = aLinks.filter(function(oLink) {
					return oLink.source !== oLink.target;
				});

				var aLinksCircle = aLinks.filter(function(oLink) {
					return oLink.source === oLink.target;
				});

				return {
					lineLinks: aLinksLine,
					circleLinks: aLinksCircle
				};
			},
			_drawLinks: function(oGroupSvg, aLinks) {

				var oLinksByType = this._getLinksByType(aLinks);

				var aLinkSvg = oGroupSvg.selectAll(".transition-link")
					.data(oLinksByType.lineLinks);
				aLinkSvg
					.enter().insert("line", ":first-child")
					.attr("class", "transition-link");
				aLinkSvg
					.exit().remove();

				var aCircleLinkSvg = oGroupSvg.selectAll(".transition-link-circle")
					.data(oLinksByType.circleLinks);
				aCircleLinkSvg
					.enter().insert("circle", ":first-child")
					.attr("class", "transition-link-circle")
					.attr("r", this.getSelfLinkCircleRadius());
				aCircleLinkSvg
					.exit().remove();

				var that = this;
				return function() {
					aLinkSvg
						.attr("x1", function(d) {
							return d.source.x;
						})
						.attr("y1", function(d) {
							return d.source.y;
						})
						.attr("x2", function(d) {
							return d.target.x;
						})
						.attr("y2", function(d) {
							return d.target.y;
						});

					aCircleLinkSvg
						.attr("cx", function(d) {
							return d.source.x + that.getSelfLinkCircleOffset();
						})
						.attr("cy", function(d) {
							return d.source.y;
						});
				};
			},
			_drawArrows: function(oGroupSvg, aLinks) {
				var iArrowWidth = this.getProperty("arrowWidth"),
					iArrowHeight = this.getProperty("arrowHeight");

				var sArrowMarkerPrefix = "arrowMarker_" + this.getId() + "_";

				var iMarkerSize = Math.max(iArrowWidth, iArrowHeight);
				var aDefsSvg = oGroupSvg.selectAll("defs").data([{}]);
				aDefsSvg.enter().append("defs");

				var oLinksByType = this._getLinksByType(aLinks);

				var aMarkerSvg = aDefsSvg
					.selectAll(".transition-link-marker").data(oLinksByType.lineLinks);
				aMarkerSvg.enter().append("marker")
					.attr("class", "transition-link-marker");
				aMarkerSvg.exit().remove();
				aMarkerSvg
					.attr("id", function(d, i) {
						return sArrowMarkerPrefix + i;
					})
					.attr("viewBox", jQuery.sap.formatMessage("-{0} -{1} {0} {2}", [iArrowHeight, iArrowWidth / 2, iArrowWidth]))
					.attr("refY", "0")
					.attr("markerWidth", iMarkerSize)
					.attr("markerHeight", iMarkerSize)
					.attr("orient", "auto");

				aMarkerSvg.selectAll("path").data([{}]).enter().append("path")
					.attr("d", jQuery.sap.formatMessage("M 0 0 L -{0} -{1} L -{0} {1} z", [iArrowHeight, iArrowWidth / 2]));

				// add markers for circle links
				var aCircleLinkMarker = aDefsSvg.selectAll(".transition-circle-link-marker")
					.data(oLinksByType.circleLinks);
				aCircleLinkMarker.enter()
					.append("marker")
					.attr("class", "transition-circle-link-marker");
				aCircleLinkMarker.exit().remove();
				aCircleLinkMarker
					.attr("id", function(d, i) {
						return sArrowMarkerPrefix + "circle_" + i;
					})
					.attr("viewBox", jQuery.sap.formatMessage("-{0} -{1} {0} {2}", [iArrowHeight, iArrowWidth / 2, iArrowWidth]))
					.attr("refX", "0")
					.attr("refY", "0")
					.attr("markerWidth", iMarkerSize)
					.attr("markerHeight", iMarkerSize)
					.attr("orient", "auto");
				aCircleLinkMarker.each(function() {
					d3.select(this).selectAll("path")
						.data([{}])
						.enter()
						.append("path")
						.attr("d", jQuery.sap.formatMessage("M 0 0 L -{0} -{1} L -{0} {1} z", [iArrowHeight, iArrowWidth / 2]));
				});

				var aLinkSvg = oGroupSvg.selectAll(".transition-link-for-arrow")
					.data(oLinksByType.lineLinks);
				aLinkSvg
					.enter().append("line")
					.attr("class", "transition-link-for-arrow");
				aLinkSvg.exit().remove();
				aLinkSvg
					.attr("marker-end", function(d, i) {
						return "url(#" + sArrowMarkerPrefix + i + ")";
					});

				var aCircleLinkSvg = oGroupSvg.selectAll(".transition-circle-link-for-arrow")
					.data(oLinksByType.circleLinks);
				aCircleLinkSvg
					.enter().append("line")
					.attr("class", "transition-circle-link-for-arrow");
				aCircleLinkSvg.exit().remove();
				aCircleLinkSvg
					.attr("marker-end", function(d, i) {
						return "url(#" + sArrowMarkerPrefix + "circle_" + i + ")";
					});

				var that = this;
				return function() {
					aLinkSvg
						.attr("x1", function(d) {
							return d.source.x;
						})
						.attr("y1", function(d) {
							return d.source.y;
						})
						.attr("x2", function(d) {
							return d.target.x;
						})
						.attr("y2", function(d) {
							return d.target.y;
						});

					aMarkerSvg
						.attr("refX", function(d) {
							return that._calculateArrowOffset(d.source, d.target);
						});

					aCircleLinkSvg
						.attr("x1", function(d) {
							return d.source.x + that.getSelfLinkCircleOffset() - that.getSelfLinkCircleRadius();
						})
						.attr("y1", function(d) {
							return d.source.y + 10;
						})
						.attr("x2", function(d) {
							return d.source.x + that.getSelfLinkCircleOffset() - that.getSelfLinkCircleRadius();
						})
						.attr("y2", function(d) {
							return d.source.y;
						})
						.attr("transform", function(d) {
							var fDegree = Math.asin(that.getCellHeight() / 2 / that.getSelfLinkCircleRadius()) * -180 / Math.PI;
							var fCenterX = d.source.x + that.getSelfLinkCircleOffset();
							var fCenterY = d.source.y;
							return jQuery.sap.formatMessage("rotate({0} {1} {2})", [fDegree, fCenterX, fCenterY]);
						});
				};
			},
			_calculateArrowOffset: function(oSourcePoint, oTargetPoint) {
				var iCellWidth = this.getProperty("cellWidth"),
					iCellHeight = this.getProperty("cellHeight");

				if (oTargetPoint.x === oSourcePoint.x) {
					return iCellHeight / 2;
				} else if (oTargetPoint.y === oSourcePoint.y) {
					return iCellWidth / 2;
				} else {
					var fPointDistance = this._calculatePointDistance(oSourcePoint, oTargetPoint);

					var fCellSlope = iCellHeight / iCellWidth;
					var fLinkSlope = Math.abs((oTargetPoint.y - oSourcePoint.y) / (oTargetPoint.x - oSourcePoint.x));
					if (fLinkSlope < fCellSlope) {
						return iCellWidth * fPointDistance / (Math.abs(oSourcePoint.x - oTargetPoint.x) * 2);
					} else {
						return iCellHeight * fPointDistance / (Math.abs(oSourcePoint.y - oTargetPoint.y) * 2);
					}
				}
			},
			_calculatePointDistance: function(oPoint1, oPoint2) {
				var dx = oPoint1.x - oPoint2.x,
					dy = oPoint1.y - oPoint2.y;
				return Math.sqrt(dx * dx + dy * dy);
			},
			_drawCells: function(oGroupSvg, aNodes, oForce) {
				var that = this;
				var sInitialStatusGUID = this._statusModel.getProperty("/initialStatus/guid");
				var iCellWidth = this.getProperty("cellWidth");
				var iCellHeight = this.getProperty("cellHeight");
				var aCellSvg = oGroupSvg.selectAll(".status-cell")
					.data(aNodes);
				aCellSvg
					.enter().append("rect")
					.attr("class", "status-cell")
					.attr("rx", 4)
					.attr("ry", 4)
					.attr("width", iCellWidth)
					.attr("height", iCellHeight)
					.attr("transform", "translate(-" + Math.floor(iCellWidth / 2) + ",-" + Math.floor(iCellHeight / 2) + ")")
					.classed("enable-drag", function() {
						return that.getDrag();
					});
				aCellSvg
					.exit().remove();
				aCellSvg
					.classed("initial-status-cell", function(d) {
						return d.guid === sInitialStatusGUID;
					});

				var aCellPinnedIcon = null;
				if (this.getPin() && this.getPinIcon()) {
					aCellPinnedIcon = oGroupSvg.selectAll(".status-cell-pin").data(aNodes);
					aCellPinnedIcon
						.enter().append("text")
						.attr("class", "status-cell-pin")
						.attr("transform", jQuery.sap.formatMessage("translate({0} {1})", [
							this.getCellWidth() / 2 - 20,
							this.getCellHeight() / -2 + 20
						]));
					aCellPinnedIcon.exit().remove();
				}

				return function() {
					aCellSvg
						.attr("x", function(d) {
							return d.x;
						})
						.attr("y", function(d) {
							return d.y;
						});
					// apply style
					that._applyStyles(aCellSvg, "cell");
					// collision detect
					aCellSvg.each(that._collide(0.5, aNodes));

					if (aCellPinnedIcon) {
						aCellPinnedIcon
							.attr("x", function(d) {
								return d.x;
							})
							.attr("y", function(d) {
								return d.y;
							})
							.text(function(d) {
								return d.statusCellFixed ? "\ue0a0" : "";
							});
					}
				};
			},
			_toggleHighlight: function(oStatus, oDom) {
				var aLowLight = d3.select(jQuery(oDom).closest("svg")[0]).selectAll(".low-light");
				if (aLowLight.size() === 0) {
					this._highlight(oStatus, oDom);
				} else {
					this._undoHighlight(oDom);
				}
			},
			_highlight: function(oStatus, oDom) {
				var oGroupSvg = d3.select(jQuery(oDom).closest("g")[0]);
				var aLinks = oGroupSvg.selectAll(".transition-link,.transition-link-circle").data();

				var aHighlightLinks = aLinks.filter(function(oLink) {
					return oLink.source === oStatus || oLink.target === oStatus;
				});
				var aHighlightStatusGUID = _.chain(aHighlightLinks)
					.flatMap(function(oLink) {
						return [oLink.source.guid, oLink.target.guid];
					})
					.uniq()
					.value();

				var fnCheckLowLightLink = function(d) {
					return !_.includes(aHighlightLinks, d);
				};

				var fnCheckLowLightStatus = function(d) {
					return !_.includes(aHighlightStatusGUID, d.guid);
				};

				oGroupSvg.selectAll(".transition-link,.transition-link-circle")
					.classed("low-light", fnCheckLowLightLink);
				oGroupSvg.selectAll(".transition-link-marker,.transition-circle-link-marker")
					.filter(fnCheckLowLightLink)
					.selectAll("path")
					.classed("low-light", true);
				oGroupSvg.selectAll(".transition-description,.self-transition-description")
					.classed("low-light", fnCheckLowLightLink);

				oGroupSvg.selectAll(".status-cell")
					.classed("low-light", fnCheckLowLightStatus);
				oGroupSvg.selectAll(".status-cell-pin")
					.classed("low-light", fnCheckLowLightStatus);
				oGroupSvg.selectAll(".status-name")
					.classed("low-light", fnCheckLowLightStatus);
				oGroupSvg.selectAll(".status-code")
					.classed("low-light", fnCheckLowLightStatus);
			},
			_undoHighlight: function(oDom) {
				d3.select(jQuery(oDom).closest("svg")[0])
					.selectAll(".low-light")
					.classed("low-light", false);
			},
			_drawNames: function(oGroupSvg, aNodes) {
				var that = this;
				var aNameSvg = oGroupSvg.selectAll(".status-name")
					.data(aNodes);
				aNameSvg
					.enter().append("text")
					.attr("class", "status-name")
					.classed("enable-drag", function() {
						return that.getDrag();
					});
				aNameSvg
					.exit().remove();
				aNameSvg
					.attr("text-anchor", "middle")
					.attr("dy", "-2")
					.text(function(d) {
						return _.truncate(d.name, {
							length: 18
						});
					});

				aNameSvg.each(function(oNode, i) {
					// show tooltip text when mouse hover.
					var oTextTitleSvg = d3.select(this).select("title");
					if (oTextTitleSvg.size() === 0) {
						oTextTitleSvg = d3.select(this).append("title");
					}
					oTextTitleSvg
						.datum(oNode)
						.text(function(d) {
							return d.name;
						});
				});

				return function() {
					aNameSvg
						.attr("x", function(d) {
							return d.x;
						})
						.attr("y", function(d) {
							return d.y;
						});
					// apply style
					that._applyStyles(aNameSvg, "text");
				};
			},
			_drawCodes: function(oGroupSvg, aNodes) {
				var that = this;
				var aCodeSvg = oGroupSvg.selectAll(".status-code")
					.data(aNodes);
				aCodeSvg
					.enter().append("text")
					.attr("class", "status-code")
					.classed("enable-drag", function() {
						return that.getDrag();
					});
				aCodeSvg
					.exit().remove();
				aCodeSvg
					.attr("text-anchor", "middle")
					.attr("dy", "13")
					.text(function(d) {
						return _.truncate(d.statusCode, {
							length: 18
						});
					});

				aCodeSvg.each(function(oNode, i) {
					// show tooltip text when mouse hover.
					var oTextTitleSvg = d3.select(this).select("title");
					if (oTextTitleSvg.size() === 0) {
						oTextTitleSvg = d3.select(this).append("title");
					}
					oTextTitleSvg
						.datum(oNode)
						.text(function(d) {
							return d.statusCode;
						});
				});

				return function() {
					aCodeSvg
						.attr("x", function(d) {
							return d.x;
						})
						.attr("y", function(d) {
							return d.y;
						});
					// apply style
					that._applyStyles(aCodeSvg, "text");
				};
			},
			_drawDescriptions: function(oGroupSvg, aLinks) {
				var that = this;
				var sPrefix = "descPath_" + this.getId() + "_";
				var oDefsSvg = oGroupSvg.selectAll("defs").data([{}]);
				oDefsSvg.enter().append("defs");

				var oLinksByType = this._getLinksByType(aLinks);

				var aDescPathSvg = oGroupSvg.selectAll("defs")
					.selectAll(".description-path").data(oLinksByType.lineLinks);
				aDescPathSvg.enter().append("path")
					.attr("class", "description-path");
				aDescPathSvg.exit().remove();
				aDescPathSvg
					.attr("id", function(d, i) {
						return sPrefix + i;
					});

				var aTextSvg = oGroupSvg.selectAll(".transition-description").data(oLinksByType.lineLinks);
				aTextSvg.enter().append("text")
					.attr("class", "transition-description")
					.attr("text-anchor", "middle");
				aTextSvg.exit().remove();

				aTextSvg.each(function(oLink, i) {
					// show text on chart, truncated when too long.
					var oTextPathSvg = d3.select(this).select("textPath");
					if (oTextPathSvg.size() === 0) {
						oTextPathSvg = d3.select(this).append("textPath");
					}
					oTextPathSvg
						.datum(oLink)
						.attr("startOffset", "50%")
						.attr("xlink:href", function() {
							return "#" + sPrefix + i;
						});

					// show tooltip text when mouse hover.
					var oTextTitleSvg = d3.select(this).select("title");
					if (oTextTitleSvg.size() === 0) {
						oTextTitleSvg = d3.select(this).append("title");
					}
					oTextTitleSvg
						.datum(oLink)
						.text(function(d) {
							return d.description;
						});
				});

				// description of self transition
				var aSelfTextSvg = oGroupSvg.selectAll(".self-transition-description").data(oLinksByType.circleLinks);
				aSelfTextSvg.enter().append("text")
					.attr("class", "self-transition-description")
					.attr("text-anchor", "middle")
					.attr("transform", function() {
						return jQuery.sap.formatMessage("translate({0} -{1})", [
							that.getSelfLinkCircleOffset(),
							that.getSelfLinkCircleRadius() + 5
						]);
					});
				aSelfTextSvg.exit().remove();
				aSelfTextSvg.text(function(d) {
					return _.truncate(d.description, {
						length: 25
					});
				});

				aSelfTextSvg.each(function(oLink, i) {
					// show tooltip text when mouse hover.
					var oTextTitleSvg = d3.select(this).select("title");
					if (oTextTitleSvg.size() === 0) {
						oTextTitleSvg = d3.select(this).append("title");
					}
					oTextTitleSvg
						.datum(oLink)
						.text(function(d) {
							return d.description;
						});
				});

				var oScale = d3.scale.linear().domain([0, 120]).range([0, 16]);

				return function() {
					var aTextPathSvg = oGroupSvg.selectAll(".transition-description").select("textPath");
					aTextPathSvg
						.attr("x", function(d, i) {
							return _.mean([d.source.x, d.target.x]);
						})
						.attr("y", function(d) {
							return _.mean([d.source.y, d.target.y]);
						})
						.text(function(d) {
							var fCenterDistance = that._calculatePointDistance(d.source, d.target),
								fCenterOffset = that._calculateArrowOffset(d.source, d.target),
								fDescSpace = fCenterDistance - fCenterOffset * 2;
							return _.truncate(d.description, {
								length: oScale(fDescSpace)
							});
						});

					aDescPathSvg
						.attr("d", function(d, i) {
							var aOrdered = that._calculateDescOrderedPath(d.source, d.target);
							var oSourcePoint = aOrdered[0],
								oTargetPoint = aOrdered[1];

							return jQuery.sap.formatMessage("M {0} {1} {2} {3}", [
								oSourcePoint.x,
								oSourcePoint.y,
								oTargetPoint.x,
								oTargetPoint.y
							]);
						})
						.attr("transform", function(d, i) {
							return that._calculateDescPathTransform(aLinks, d.source, d.target);
						});

					aSelfTextSvg
						.attr("x", function(d) {
							return d.source.x;
						})
						.attr("y", function(d) {
							return d.source.y;
						});
				};
			},
			_calculateDescOrderedPath: function(oSourcePoint, oTargetPoint) {
				if (oSourcePoint.x < oTargetPoint.x) {
					return [oSourcePoint, oTargetPoint];
				} else if (oSourcePoint.x > oTargetPoint.x) {
					return [oTargetPoint, oSourcePoint];
				} else {
					if (oSourcePoint.y < oTargetPoint.y) {
						return [oTargetPoint, oSourcePoint];
					} else {
						return [oSourcePoint, oTargetPoint];
					}
				}
			},
			_calculateDescPathTransform: function(aLinks, oSourcePoint, oTargetPoint) {
				var iDistance = 8;
				if (this._checkHasPreviousReversedLink(aLinks, oSourcePoint, oTargetPoint)) {
					iDistance = -15;
				}
				var iDeltaX = oSourcePoint.x - oTargetPoint.x,
					iDeltaY = oSourcePoint.y - oTargetPoint.y;
				var fAlpha;
				if (iDeltaX === 0) {
					fAlpha = Math.PI / 2 * (iDeltaY >= 0 ? -1 : 1);
				} else {
					fAlpha = Math.atan(iDeltaY / iDeltaX);
				}
				return jQuery.sap.formatMessage("translate({0} {1})", [
					iDistance * Math.sin(fAlpha),
					iDistance * Math.cos(fAlpha) * -1
				]);
			},
			_checkHasPreviousReversedLink: function(aLinks, oSourcePoint, oTargetPoint) {
				var iReversedLinkIndex = _.findIndex(aLinks, function(oLink) {
					return oLink.source === oTargetPoint && oLink.target === oSourcePoint;
				});
				if (iReversedLinkIndex < 0) {
					return false;
				} else {
					var iLinkIndex = _.findIndex(aLinks, function(oLink) {
						return oLink.source === oSourcePoint && oLink.target === oTargetPoint;
					});
					return iReversedLinkIndex < iLinkIndex;
				}
			},
			_applyStyles: function(aSelection, sStyleProperty) {
				var that = this;
				aSelection.each(function(d) {
					var oElement = this;
					_.each(that._aStyle, function(oStyle) {
						if (_.isMatch(d, oStyle.matcher)) {
							d3.select(oElement).style(oStyle[sStyleProperty]);
						}
					});
				});
			},
			_collide: function(alpha, aNodes) {
				//TODO: good to have checking for rectangles, not circles.
				var quadtree = d3.geom.quadtree(aNodes);
				var iWidth = this.getProperty("cellWidth");
				var iHeight = this.getProperty("cellHeight");
				var radius = Math.sqrt(iWidth * iWidth + iHeight * iHeight) / 2;
				var padding = 100;
				return function(d) {
					var rb = 2 * radius + padding,
						nx1 = d.x - rb,
						nx2 = d.x + rb,
						ny1 = d.y - rb,
						ny2 = d.y + rb;
					quadtree.visit(function(quad, x1, y1, x2, y2) {
						if (quad.point && (quad.point !== d)) {

							if (d.fixed && quad.point.fixed) {
								// not to test collision when two nodes are fixed
								return true;
							}

							var x = d.x - quad.point.x,
								y = d.y - quad.point.y,
								l = Math.sqrt(x * x + y * y);
							if (l < rb) {
								l = (l - rb) / l * alpha;
								d.x -= x *= l;
								d.y -= y *= l;
								quad.point.x += x;
								quad.point.y += y;
							}
						}
						return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
					});
				};
			}
		});
		return StatusModelPreview;
	}, /* bExport= */ true);