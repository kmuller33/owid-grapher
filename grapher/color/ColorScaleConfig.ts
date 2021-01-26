import { observable } from "mobx"
import { Color } from "../../coreTable/CoreTableConstants"
import { ColumnColorScale } from "../../coreTable/CoreColumnDef"
import {
    deleteRuntimeAndUnchangedProps,
    objectWithPersistablesToObject,
    Persistable,
    updatePersistables,
} from "../persistable/Persistable"
import { extend, isEmpty, trimObject } from "../../clientUtils/Util"
import { ColorSchemeName } from "./ColorConstants"
import { BinningStrategy } from "./BinningStrategy"

export class ColorScaleConfigDefaults {
    // Color scheme
    // ============

    /** Key for a colorbrewer scheme */
    @observable baseColorScheme?: ColorSchemeName

    /** Reverse the order of colors in the color scheme (defined by `baseColorScheme`) */
    @observable colorSchemeInvert?: boolean = undefined

    // Numeric bins
    // ============

    /** The strategy for generating the bin boundaries */
    @observable binningStrategy: BinningStrategy = BinningStrategy.ckmeans
    /** The *suggested* number of bins for the automatic binning algorithm */
    @observable binningStrategyBinCount?: number

    /** The minimum bracket of the first bin */
    @observable customNumericMinValue?: number
    /** Custom maximum brackets for each numeric bin. Only applied when strategy is `manual`. */
    @observable customNumericValues: number[] = []
    /**
     * Custom labels for each numeric bin. Only applied when strategy is `manual`.
     * `undefined` or `null` falls back to default label.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericLabels: (string | undefined | null)[] = []

    /** Whether `customNumericColors` are used to override the color scheme. */
    @observable customNumericColorsActive?: boolean = undefined
    /**
     * Override some or all colors for the numerical color legend.
     * `undefined` or `null` falls back the color scheme color.
     * We need to handle `null` because JSON serializes `undefined` values
     * inside arrays into `null`.
     */
    @observable customNumericColors: (Color | undefined | null)[] = []

    /** Whether the visual scaling for the color legend is disabled. */
    @observable equalSizeBins?: boolean = undefined

    // Categorical bins
    // ================

    @observable.ref customCategoryColors: {
        [key: string]: string | undefined
    } = {}

    @observable.ref customCategoryLabels: {
        [key: string]: string | undefined
    } = {}

    // Allow hiding categories from the legend
    @observable.ref customHiddenCategories: {
        [key: string]: true | undefined
    } = {}

    // Other
    // =====

    /** A custom legend description. Only used in ScatterPlot legend titles for now. */
    @observable legendDescription?: string = undefined
}

export type ColorScaleConfigInterface = ColorScaleConfigDefaults

export class ColorScaleConfig
    extends ColorScaleConfigDefaults
    implements Persistable {
    updateFromObject(obj: any) {
        extend(this, obj)
    }

    toObject() {
        const obj = objectWithPersistablesToObject(this)
        deleteRuntimeAndUnchangedProps(obj, new ColorScaleConfigDefaults())
        return trimObject(obj)
    }

    constructor(obj?: Partial<ColorScaleConfig>) {
        super()
        updatePersistables(this, obj)
    }

    static fromDSL(scale: ColumnColorScale) {
        const colorSchemeInvert = scale.colorScaleInvert
        const baseColorScheme = scale.colorScaleScheme as ColorSchemeName

        const customNumericValues: number[] = []
        const customNumericLabels: string[] = []
        const customNumericColors: Color[] = []
        scale.colorScaleNumericBins?.split(INTER_BIN_DELIMITER).map((bin) => {
            const [color, value, ...label] = bin.split(INTRA_BIN_DELIMITER)
            customNumericValues.push(parseFloat(value))
            customNumericLabels.push(label.join(INTRA_BIN_DELIMITER))
            customNumericColors.push(color)
        })

        const customCategoryColors: {
            [key: string]: string | undefined
        } = {}

        const customCategoryLabels: {
            [key: string]: string | undefined
        } = {}
        scale.colorScaleCategoricalBins
            ?.split(INTER_BIN_DELIMITER)
            .map((bin) => {
                const [color, value, ...label] = bin.split(INTRA_BIN_DELIMITER)
                customCategoryColors[value] = color
                customCategoryLabels[value] = label.join(INTRA_BIN_DELIMITER)
            })
        const trimmed = trimObject({
            colorSchemeInvert,
            baseColorScheme,
            customNumericColors,
            customNumericLabels,
            customNumericValues,
        })
        return isEmpty(trimmed) ? undefined : trimmed
    }

    toDSL(): ColumnColorScale {
        const {
            baseColorScheme,
            binningStrategy,
            colorSchemeInvert,
            customNumericValues,
            customNumericColors,
            customNumericLabels,
            customCategoryLabels,
            customCategoryColors,
        } = this.toObject()

        return trimObject({
            colorScaleScheme: baseColorScheme,
            colorScaleInvert: colorSchemeInvert,
            colorScaleBinningStrategy: binningStrategy,
            colorScaleNumericBins: (customNumericValues ?? [])
                .map((value: any, index: number) =>
                    [
                        customNumericColors[index] ?? "",
                        value,
                        customNumericLabels[index],
                    ].join(INTRA_BIN_DELIMITER)
                )
                .join(INTER_BIN_DELIMITER),
            colorScaleCategoricalBins: Object.keys(customCategoryColors ?? {})
                .map((value) =>
                    [
                        customCategoryColors[value],
                        value,
                        customCategoryLabels[value],
                    ].join(INTRA_BIN_DELIMITER)
                )
                .join(INTER_BIN_DELIMITER),
        })
    }
}

const INTER_BIN_DELIMITER = ";"
const INTRA_BIN_DELIMITER = ";"
