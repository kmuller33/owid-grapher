/* StackedArea.tsx
 * ================
 *
 * A stacked area chart.
 *
 */

import * as React from 'react'
import * as _ from 'lodash'
import * as d3 from 'd3'
import * as $ from 'jquery'
import {computed, action} from 'mobx'
import {observer} from 'mobx-react'
import ChartConfig from './ChartConfig'
import Bounds from './Bounds'
import LineType from './LineType'
import {defaultTo} from './Util'
import AxisBox from './AxisBox'
import StandardAxisBoxView from './StandardAxisBoxView'
import Lines from './Lines'
import {preInstantiate} from "./Util"
import Paragraph from './Paragraph'
import AxisScale from './AxisScale'
import Color from './Color'
import {HorizontalAxis, HorizontalAxisView} from './Axis'
import {AxisGridLines} from './AxisBox'

export interface DiscreteBarDatum {
    value: number,
    label: string,
    color: Color
}

@observer
export default class DiscreteBarChart extends React.Component<{ bounds: Bounds, chart: ChartConfig }, undefined> {
    @computed get chart() { return this.props.chart }
    @computed get bounds() { return this.props.bounds.padRight(10) }

    @computed get data() {
        return this.props.chart.discreteBar.data
    }

    @computed get legendFontSize() {
        return 0.7
    }

    // Account for the width of the legend
    @computed get legendWidth() {
        const longestLabel = _.sortBy(this.data, d => -d.label.length)[0].label
        return Bounds.forText(longestLabel, { fontSize: this.legendFontSize+'em' }).width
    }

    // Account for the width of the little value labels at the end of bars
    @computed get valueFontSize() {
        return 0.6
    }

    @computed get maxValueWidth() {
        return Bounds.forText(_.sortBy(this.data, d => -d.value.toString().length)[0].value.toString(), { fontSize: this.valueFontSize+'em' }).width
    }

    // Now we can work out the main x axis scale
    @computed get xDomainDefault(): [number, number] {
        return [0, _.max(_.map(this.data, d => d.value))]
    }

    @computed get xRange() {
        return [this.bounds.left+this.legendWidth, this.bounds.right-this.maxValueWidth]
    }

    @computed get xScale() {
        const xAxis = this.chart.yAxis.toSpec({ defaultDomain: this.xDomainDefault })
        return new AxisScale(xAxis).extend({ range: this.xRange })
    }

    @computed get xAxis() {
        const _this = this
        return new HorizontalAxis({
            get scale() { return _this.xScale },
            get labelText() { return _this.chart.xAxis.label }
        })
    }

    @computed get innerBounds() {
        return this.bounds.padLeft(this.legendWidth).padBottom(this.xAxis.height).padRight(this.maxValueWidth)
    }

    @computed get barHeight() {
        return 0.8 * this.innerBounds.height/this.data.length        
    }

    @computed get barSpacing() {
        return (this.innerBounds.height/this.data.length) - this.barHeight
    }

    render() {
        const {chart, data, bounds, legendWidth, xAxis, xScale, innerBounds, barHeight, barSpacing, valueFontSize} = this

        let yOffset = this.innerBounds.top+barHeight/2

        return <g className="DiscreteBarChart">
            <HorizontalAxisView bounds={bounds} axis={xAxis}/>
            <AxisGridLines orient="bottom" scale={xScale} bounds={bounds.padLeft(legendWidth).padBottom(xAxis.height)}/>
            {_.map(data, (d, i) => {
                const result = <g>
                    <text x={bounds.left+legendWidth-5} y={yOffset} fill="#666" dominant-baseline="middle" textAnchor="end" fontSize={valueFontSize+'em'}>{d.label}</text>
                    <rect x={xScale.range[0]} y={yOffset-barHeight/2} width={xScale.place(d.value)-xScale.range[0]} height={barHeight} fill="#F2585B" opacity={0.85}/>
                    <text x={xScale.place(d.value)+5} y={yOffset} fill="#666" dominant-baseline="middle" fontSize="0.55em">{d.value}</text>
                </g>
                yOffset += barHeight+barSpacing
                return result
            })}
        </g>
    }
}