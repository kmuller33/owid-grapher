import * as React from "react"
import {
    sortBy,
    sum,
    guid,
    getRelativeMouse,
    pointsToPath,
    minBy,
    flatten,
    last,
} from "grapher/utils/Util"
import { computed, action, observable } from "mobx"
import { observer } from "mobx-react"
import { select } from "d3-selection"
import { easeLinear } from "d3-ease"
import { Bounds, DEFAULT_BOUNDS } from "grapher/utils/Bounds"
import { DualAxisComponent } from "grapher/axis/AxisViews"
import { DualAxis } from "grapher/axis/Axis"
import { PointVector } from "grapher/utils/PointVector"
import {
    LineLegend,
    LineLabelMark,
    LineLegendManager,
} from "grapher/lineLegend/LineLegend"
import { ComparisonLine } from "grapher/scatterCharts/ComparisonLine"
import { Tooltip } from "grapher/tooltip/Tooltip"
import { NoDataModal } from "grapher/chart/NoDataModal"
import { extent } from "d3-array"
import { EntityName } from "coreTable/CoreTableConstants"
import {
    BASE_FONT_SIZE,
    SeriesName,
    ScaleType,
    ValueRange,
} from "grapher/core/GrapherConstants"
import { ColorSchemes, ColorScheme } from "grapher/color/ColorSchemes"
import { AxisConfig } from "grapher/axis/AxisConfig"
import { ChartInterface } from "grapher/chart/ChartInterface"
import {
    LinesProps,
    LineChartMark,
    LineChartManager,
} from "./LineChartConstants"

const BLUR_COLOR = "#eee"

@observer
class Lines extends React.Component<LinesProps> {
    base: React.RefObject<SVGGElement> = React.createRef()

    @computed private get allValues() {
        return flatten(this.props.placedMarks.map((series) => series.points))
    }

    @action.bound private onCursorMove(ev: MouseEvent | TouchEvent) {
        const { dualAxis } = this.props
        const { horizontalAxis } = dualAxis

        const mouse = getRelativeMouse(this.base.current, ev)

        let hoverX
        if (dualAxis.innerBounds.contains(mouse)) {
            const closestValue = minBy(this.allValues, (point) =>
                Math.abs(horizontalAxis.place(point.x) - mouse.x)
            )
            hoverX = closestValue?.x
        }

        this.props.onHover(hoverX)
    }

    @action.bound private onCursorLeave() {
        this.props.onHover(undefined)
    }

    @computed get bounds() {
        const { horizontalAxis, verticalAxis } = this.props.dualAxis
        return Bounds.fromCorners(
            new PointVector(horizontalAxis.range[0], verticalAxis.range[0]),
            new PointVector(horizontalAxis.range[1], verticalAxis.range[1])
        )
    }

    @computed private get focusedLines() {
        const { focusedSeriesNames } = this.props
        // If nothing is focused, everything is
        if (!focusedSeriesNames.length) return this.props.placedMarks
        return this.props.placedMarks.filter((series) =>
            focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get backgroundLines() {
        const { focusedSeriesNames } = this.props
        return this.props.placedMarks.filter(
            (series) => !focusedSeriesNames.includes(series.seriesName)
        )
    }

    // Don't display point markers if there are very many of them for performance reasons
    // Note that we're using circle elements instead of marker-mid because marker performance in Safari 10 is very poor for some reason
    @computed private get hasMarkers() {
        if (this.props.hidePoints) return false
        return (
            sum(
                this.props.placedMarks.map(
                    (series) => series.placedPoints.length
                )
            ) < 500
        )
    }

    @computed private get strokeWidth() {
        return this.props.lineStrokeWidth ?? 1.5
    }

    private renderFocusGroups() {
        return this.focusedLines.map((series, index) => (
            <g key={index}>
                <path
                    stroke={series.color}
                    strokeLinecap="round"
                    d={pointsToPath(
                        series.placedPoints.map((value) => [
                            value.x,
                            value.y,
                        ]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={this.strokeWidth}
                    strokeDasharray={series.isProjection ? "1,4" : undefined}
                />
                {this.hasMarkers && !series.isProjection && (
                    <g fill={series.color}>
                        {series.placedPoints.map((value, index) => (
                            <circle
                                key={index}
                                cx={value.x}
                                cy={value.y}
                                r={2}
                            />
                        ))}
                    </g>
                )}
            </g>
        ))
    }

    private renderBackgroundGroups() {
        return this.backgroundLines.map((series, index) => (
            <g key={index}>
                <path
                    key={series.seriesName + "-line"}
                    strokeLinecap="round"
                    stroke="#ddd"
                    d={pointsToPath(
                        series.placedPoints.map((value) => [
                            value.x,
                            value.y,
                        ]) as [number, number][]
                    )}
                    fill="none"
                    strokeWidth={1}
                />
            </g>
        ))
    }

    private container?: SVGElement
    componentDidMount() {
        const base = this.base.current as SVGGElement
        const container = base.closest("svg") as SVGElement
        container.addEventListener("mousemove", this.onCursorMove)
        container.addEventListener("mouseleave", this.onCursorLeave)
        container.addEventListener("touchstart", this.onCursorMove)
        container.addEventListener("touchmove", this.onCursorMove)
        container.addEventListener("touchend", this.onCursorLeave)
        container.addEventListener("touchcancel", this.onCursorLeave)
        this.container = container
    }

    componentWillUnmount() {
        const { container } = this
        if (!container) return

        container.removeEventListener("mousemove", this.onCursorMove)
        container.removeEventListener("mouseleave", this.onCursorLeave)
        container.removeEventListener("touchstart", this.onCursorMove)
        container.removeEventListener("touchmove", this.onCursorMove)
        container.removeEventListener("touchend", this.onCursorLeave)
        container.removeEventListener("touchcancel", this.onCursorLeave)
    }

    render() {
        const { bounds } = this

        return (
            <g ref={this.base} className="Lines">
                <rect
                    x={Math.round(bounds.x)}
                    y={Math.round(bounds.y)}
                    width={Math.round(bounds.width)}
                    height={Math.round(bounds.height)}
                    fill="rgba(255,255,255,0)"
                    opacity={0}
                />
                {this.renderBackgroundGroups()}
                {this.renderFocusGroups()}
            </g>
        )
    }
}

@observer
export class LineChart
    extends React.Component<{
        bounds?: Bounds
        manager: LineChartManager
    }>
    implements ChartInterface, LineLegendManager {
    base: React.RefObject<SVGSVGElement> = React.createRef()

    @observable hoverX?: number
    @action.bound onHover(hoverX: number | undefined) {
        this.hoverX = hoverX
    }

    @computed private get manager() {
        return this.props.manager
    }

    @computed get bounds() {
        return this.props.bounds ?? DEFAULT_BOUNDS
    }

    @computed get maxLegendWidth() {
        return this.bounds.width / 3
    }

    seriesIsBlurred(series: LineChartMark) {
        return (
            this.isFocusMode &&
            !this.focusedSeriesNames.includes(series.seriesName)
        )
    }

    @computed private get tooltip() {
        const { hoverX, dualAxis } = this

        if (hoverX === undefined) return undefined

        const sortedData = sortBy(this.marks, (series) => {
            const value = series.points.find((point) => point.x === hoverX)
            return value !== undefined ? -value.y : Infinity
        })

        const formatted = this.manager.table.timeColumnFormatFunction(hoverX)

        return (
            <Tooltip
                tooltipManager={this.manager}
                x={dualAxis.horizontalAxis.place(hoverX)}
                y={
                    dualAxis.verticalAxis.rangeMin +
                    dualAxis.verticalAxis.rangeSize / 2
                }
                style={{ padding: "0.3em" }}
                offsetX={5}
            >
                <table
                    style={{
                        fontSize: "0.9em",
                        lineHeight: "1.4em",
                        whiteSpace: "normal",
                    }}
                >
                    <tbody>
                        <tr>
                            <td colSpan={3}>
                                <strong>{formatted}</strong>
                            </td>
                        </tr>
                        {sortedData.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )

                            const annotation = this.getAnnotationsForSeries(
                                series.seriesName
                            )

                            // It sometimes happens that data is missing for some years for a particular
                            // entity. If the user hovers over these years, we want to show a "No data"
                            // notice. However, we only want to show this notice when we are in the middle
                            // of a time series – when data points exist before and after the current year.
                            // Otherwise we want to entirely exclude the entity from the tooltip.
                            if (!value) {
                                const [startX, endX] = extent(
                                    series.points,
                                    (point) => point.x
                                )
                                if (
                                    startX === undefined ||
                                    endX === undefined ||
                                    startX > hoverX ||
                                    endX < hoverX
                                )
                                    return undefined
                            }

                            const isBlur =
                                this.seriesIsBlurred(series) ||
                                value === undefined
                            const textColor = isBlur ? "#ddd" : "#333"
                            const annotationColor = isBlur ? "#ddd" : "#999"
                            const circleColor = isBlur
                                ? BLUR_COLOR
                                : series.color
                            return (
                                <tr
                                    key={series.seriesName}
                                    style={{ color: textColor }}
                                >
                                    <td>
                                        <div
                                            style={{
                                                width: "10px",
                                                height: "10px",
                                                borderRadius: "5px",
                                                backgroundColor: circleColor,
                                                display: "inline-block",
                                                marginRight: "2px",
                                            }}
                                        />
                                    </td>
                                    <td
                                        style={{
                                            paddingRight: "0.8em",
                                            fontSize: "0.9em",
                                        }}
                                    >
                                        {this.manager.table.getLabelForEntityName(
                                            series.seriesName
                                        )}
                                        {annotation && (
                                            <span
                                                className="tooltipAnnotation"
                                                style={{
                                                    color: annotationColor,
                                                    fontSize: "90%",
                                                }}
                                            >
                                                {" "}
                                                {annotation}
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            textAlign: "right",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {!value
                                            ? "No data"
                                            : dualAxis.verticalAxis.formatTick(
                                                  value.y
                                                  //  ,{ noTrailingZeroes: false } // todo: add back?
                                              )}
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </Tooltip>
        )
    }

    defaultRightPadding = 1

    @observable hoveredSeriesName?: SeriesName
    @action.bound onLegendClick() {
        if (this.manager.showAddEntityControls)
            this.manager.isSelectingData = true
    }

    @action.bound onLegendMouseOver(seriesName: SeriesName) {
        this.hoveredSeriesName = seriesName
    }

    @action.bound onLegendMouseLeave() {
        this.hoveredSeriesName = undefined
    }

    @computed get focusedSeriesNames() {
        return this.hoveredSeriesName ? [this.hoveredSeriesName] : []
    }

    @computed get isFocusMode() {
        return this.focusedSeriesNames.length > 0
    }

    animSelection?: d3.Selection<
        d3.BaseType,
        unknown,
        SVGGElement | null,
        unknown
    >
    componentDidMount() {
        // Fancy intro animation

        const base = select(this.base.current)
        this.animSelection = base.selectAll("clipPath > rect").attr("width", 0)

        this.animSelection
            .transition()
            .duration(800)
            .ease(easeLinear)
            .attr("width", this.bounds.width)
            .on("end", () => this.forceUpdate()) // Important in case bounds changes during transition
    }

    componentWillUnmount() {
        if (this.animSelection) this.animSelection.interrupt()
    }

    @computed get renderUid() {
        return guid()
    }

    @computed get fontSize() {
        return this.manager.baseFontSize ?? BASE_FONT_SIZE
    }

    @computed get legendX(): number {
        return this.bounds.right - (this.legendDimensions?.width || 0)
    }

    @computed private get legendDimensions() {
        return this.manager.hideLegend
            ? undefined
            : new LineLegend({ manager: this })
    }

    render() {
        if (this.failMessage)
            return (
                <NoDataModal
                    manager={this.manager}
                    bounds={this.props.bounds}
                    message={this.failMessage}
                />
            )

        const { manager, bounds, tooltip, dualAxis, renderUid, hoverX } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        const comparisonLines = manager.comparisonLines || []

        return (
            <svg
                ref={this.base}
                className="LineChart"
                width={this.bounds.width}
                height={this.bounds.height}
            >
                <defs>
                    <clipPath id={`boundsClip-${renderUid}`}>
                        {/* The tiny bit of extra space here is to ensure circles centered on the very edge are still fully visible */}
                        <rect
                            x={dualAxis.innerBounds.x - 10}
                            y={bounds.y}
                            width={bounds.width + 10}
                            height={bounds.height * 2}
                        ></rect>
                    </clipPath>
                </defs>
                <DualAxisComponent
                    isInteractive={this.manager.isInteractive}
                    dualAxis={dualAxis}
                    showTickMarks={true}
                />
                <g clipPath={`url(#boundsClip-${renderUid})`}>
                    {comparisonLines.map((line, index) => (
                        <ComparisonLine
                            key={index}
                            dualAxis={dualAxis}
                            comparisonLine={line}
                        />
                    ))}
                    <LineLegend manager={this} />
                    <Lines
                        dualAxis={dualAxis}
                        placedMarks={this.placedMarks}
                        hidePoints={this.manager.hidePoints}
                        onHover={this.onHover}
                        focusedSeriesNames={this.focusedSeriesNames}
                        lineStrokeWidth={this.manager.lineStrokeWidth}
                    />
                </g>
                {hoverX !== undefined && (
                    <g className="hoverIndicator">
                        {this.marks.map((series) => {
                            const value = series.points.find(
                                (point) => point.x === hoverX
                            )
                            if (!value || this.seriesIsBlurred(series))
                                return null

                            return (
                                <circle
                                    key={series.seriesName}
                                    cx={horizontalAxis.place(value.x)}
                                    cy={verticalAxis.place(value.y)}
                                    r={4}
                                    fill={series.color}
                                />
                            )
                        })}
                        <line
                            x1={horizontalAxis.place(hoverX)}
                            y1={verticalAxis.range[0]}
                            x2={horizontalAxis.place(hoverX)}
                            y2={verticalAxis.range[1]}
                            stroke="rgba(180,180,180,.4)"
                        />
                    </g>
                )}

                {tooltip}
            </svg>
        )
    }

    @computed get failMessage() {
        const { yColumn } = this
        if (!yColumn) return "Missing Y axis column"
        if (!this.marks.length) return "No matching data"
        return ""
    }

    @computed private get yColumn() {
        return this.table.get(
            this.manager.yColumnSlug ?? this.manager.yColumnSlugs![0]
        )
    }

    @computed private get yColumns() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs.map((slug) => this.table.get(slug)!)
            : [this.yColumn!]
    }

    @computed private get annotationsMap() {
        return this.annotationsColumn?.entityNameMap
    }

    // todo: make work again
    @computed private get annotationsColumn() {
        return this.manager.table.get("annotations")
    }

    @computed private get colorScheme() {
        const colorScheme = ColorSchemes[this.manager.baseColorScheme as string]
        return colorScheme !== undefined
            ? colorScheme
            : (ColorSchemes["owid-distinct"] as ColorScheme)
    }

    @computed get table() {
        let table = this.manager.table.filterBySelectedOnly()

        table = table.filterByFullColumnsOnly(this.yColumnSlugs) // TODO: instead of this, just filter indvidaul points.

        if (this.manager.isRelativeMode)
            table = table.toTotalGrowthForEachColumnComparedToStartTime(
                this.manager.table.minTime!,
                this.yColumnSlugs
            )
        return table
    }

    @computed private get yColumnSlugs() {
        return this.manager.yColumnSlugs
            ? this.manager.yColumnSlugs
            : this.manager.yColumnSlug
            ? [this.manager.yColumnSlug]
            : []
    }

    @computed get marks() {
        const { yColumns } = this
        const chartData: LineChartMark[] = flatten(
            yColumns.map((col) => {
                const { isProjection } = col
                const map = col.owidRowsByEntityName
                return Array.from(map.keys()).map((entityName) => {
                    const seriesName =
                        yColumns.length > 1 ? col.displayName : entityName
                    return {
                        // todo: add log filter
                        points: map
                            .get(entityName)!
                            .filter((row) => typeof row.value === "number") // todo: move somewhere else?
                            .map((row) => {
                                return {
                                    x: row.time,
                                    y: row.value,
                                }
                            }),
                        seriesName,
                        isProjection,
                        color: "#000", // tmp
                    }
                })
            })
        )

        this._addColorsToSeries(chartData)
        return chartData
    }

    @computed get placedMarks() {
        const { dualAxis } = this
        const { horizontalAxis, verticalAxis } = dualAxis

        return this.marks.map((mark) => {
            return {
                ...mark,
                placedPoints: mark.points.map(
                    (point) =>
                        new PointVector(
                            Math.round(horizontalAxis.place(point.x)),
                            Math.round(verticalAxis.place(point.y))
                        )
                ),
            }
        })
    }

    private _addColorsToSeries(allSeries: LineChartMark[]) {
        // Color from lowest to highest
        const sorted = sortBy(allSeries, (series) => last(series.points)!.y)

        const colors = this.colorScheme.getColors(sorted.length)
        if (this.manager.invertColorScheme) colors.reverse()

        const table = this.manager.table

        sorted.forEach((series, i) => {
            series.color =
                colors[i] || table.getColorForEntityName(series.seriesName)
        })
    }

    getAnnotationsForSeries(entityName: EntityName) {
        const annotationsMap = this.annotationsMap
        const annos = annotationsMap?.get(entityName)
        return annos ? Array.from(annos.values()).join(" & ") : undefined
    }

    // Order of the legend items on a line chart should visually correspond
    // to the order of the lines as the approach the legend
    @computed get labelMarks(): LineLabelMark[] {
        // If there are any projections, ignore non-projection legends
        // Bit of a hack
        let toShow = this.marks
        if (toShow.some((g) => !!g.isProjection))
            toShow = toShow.filter((g) => g.isProjection)

        return toShow.map((series) => {
            const lastValue = last(series.points)!.y
            return {
                color: series.color,
                seriesName: series.seriesName,
                // E.g. https://ourworldindata.org/grapher/size-poverty-gap-world
                label: this.manager.hideLegend
                    ? ""
                    : `${this.table.getLabelForEntityName(series.seriesName)}`,
                annotation: this.getAnnotationsForSeries(series.seriesName),
                yValue: lastValue,
            }
        })
    }

    // todo: Refactor
    @computed private get dualAxis(): DualAxis {
        return new DualAxis({
            bounds: this.bounds.padRight(
                this.legendDimensions
                    ? this.legendDimensions.width
                    : this.defaultRightPadding
            ),
            verticalAxis: this.verticalAxisPart,
            horizontalAxis: this.horizontalAxisPart,
        })
    }

    @computed get verticalAxis() {
        return this.dualAxis.verticalAxis
    }

    @computed private get horizontalAxisPart() {
        const xAxisConfig =
            this.manager.xAxis || new AxisConfig(undefined, this)

        if (this.manager.hideXAxis) xAxisConfig.hideAxis = true

        const axis = xAxisConfig.toHorizontalAxis()
        axis.updateDomainPreservingUserSettings([
            this.yColumn!.startTimelineTime,
            this.yColumn!.endTimelineTime,
        ])
        axis.scaleType = ScaleType.linear
        axis.scaleTypeOptions = [ScaleType.linear]
        axis.formatColumn = this.manager.table.timeColumn
        axis.hideFractionalTicks = true
        axis.hideGridlines = true
        return axis
    }

    @computed private get verticalAxisPart() {
        const { manager } = this

        const yAxisConfig =
            this.manager.yAxis || new AxisConfig(undefined, this)

        if (this.manager.hideYAxis) yAxisConfig.hideAxis = true

        const yDomain = this.table.domainFor(this.yColumnSlugs)
        const domain = yAxisConfig.domain
        const yDefaultDomain: ValueRange = [
            Math.min(domain[0], yDomain[0]),
            Math.max(domain[1], yDomain[1]),
        ]

        const axis = yAxisConfig.toVerticalAxis()
        axis.updateDomainPreservingUserSettings(yDefaultDomain)
        if (manager.isRelativeMode) axis.scaleTypeOptions = [ScaleType.linear]
        axis.hideFractionalTicks = this.yColumn!.isAllIntegers // all y axis points are integral, don't show fractional ticks in that case
        axis.label = ""
        axis.formatColumn = this.yColumn
        return axis
    }
}
