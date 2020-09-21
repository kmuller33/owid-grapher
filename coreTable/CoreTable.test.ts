#! /usr/bin/env yarn jest

import { AnyTable } from "./CoreTable"

describe("toDelimited", () => {
    const csv = `country,Population in 2020
iceland,1`
    const table = AnyTable.fromDelimited(csv)
    it("delimited uses slugs as default", () => {
        const csv = table.toDelimited()
        expect(csv).toEqual(`country,Population-in-2020
iceland,1`)
        expect(table.get("country")!.isEmpty).toBe(false)
    })

    it("can export a clean csv with dates", () => {
        const table = new AnyTable(
            [
                { entityName: "Aruba", day: 1, annotation: "Something, foo" },
                { entityName: "Canada", day: 2 },
            ],
            [
                { slug: "entityName" },
                { slug: "day", type: "Date" as any },
                { slug: "annotation" },
            ]
        )

        expect(table.constantColumns().length).toEqual(0)

        expect(table.toView().toPrettyCsv()).toEqual(`entityName,day,annotation
Aruba,2020-01-22,"Something, foo"
Canada,2020-01-23,`)
    })
})

describe("parsing", () => {
    it("is all integers", () => {
        const table = AnyTable.fromDelimited(`gdp,perCapita
123,123.1`)
        expect(table.get("gdp")?.isAllIntegers).toBeTruthy()
        expect(table.get("perCapita")?.isAllIntegers).toBeFalsy()
    })
})

describe("immutability", () => {
    const rows = [{ country: "USA" }, { country: "Germany" }]
    const table = new AnyTable(rows)
    it("does not modify rows", () => {
        table.addNumericComputedColumn({
            slug: "firstLetter",
            fn: (row) => row.country.length,
        })
        expect(table.get("firstLetter")?.parsedValues.join("")).toEqual(`37`)
        expect((rows[0] as any).firstLetter).toEqual(undefined)
    })
})

describe("from csv", () => {
    const csv = `country,population
iceland,1
france,50
usa,300
canada,20`
    const table = AnyTable.fromDelimited(csv)

    it("a table can be made from csv", () => {
        expect(table.rows.length).toEqual(4)
        expect(Array.from(table.columnsByName.keys())).toEqual([
            "country",
            "population",
        ])
    })

    describe("filtering", () => {
        const col = table.get("country")!
        it("one filter works", () => {
            expect(col.parsedValues[3]).toEqual("canada")
            table.addFilterColumn(
                "pop_filter",
                (row) => parseInt(row.population) > 40
            )
            expect(col?.parsedValues[0]).toEqual("france")
            expect(col?.parsedValues[1]).toEqual("usa")
        })

        it("multiple filters work", () => {
            table.addFilterColumn("name_filter", (row) =>
                (row.country as string).startsWith("u")
            )
            expect(col?.parsedValues[0]).toEqual("usa")
            expect(col?.parsedValues[1]).toEqual(undefined)
        })

        it("adding rows works with filters", () => {
            table.cloneAndAddRowsAndDetectColumns([
                { country: "ireland", population: "7" },
                { country: "united kingdom", population: "60" },
            ])
            expect(col?.parsedValues[0]).toEqual("usa")
            expect(col?.parsedValues[1]).toEqual("united kingdom")
        })
    })
})

describe("annotations column", () => {
    const csv = `entityName,pop,notes,year
usa,322,in hundreds of millions,2000
hi,1,in millions,2000
hi,1,,2001`
    const table = AnyTable.fromDelimited(csv)

    it("can get annotations for a row", () => {
        const annotationsColumn = table.get("notes")
        const entityNameMap = annotationsColumn!.entityNameMap

        expect(entityNameMap.size).toEqual(2)
        expect(entityNameMap.get("hi")).toContain("in millions")
        expect(entityNameMap.get("usa")).toContain("in hundreds of millions")
    })
})