import * as AST from "@effect/schema/AST"
import * as S from "@effect/schema/Schema"
import * as Util from "@effect/schema/test/TestUtils"
import { describe, expect, it } from "vitest"

describe("Union", () => {
  it("annotations()", () => {
    const schema = S.Union(S.String, S.Number).annotations({ identifier: "X" }).annotations({ title: "Y" })
    expect(schema.ast.annotations).toStrictEqual({
      [AST.IdentifierAnnotationId]: "X",
      [AST.TitleAnnotationId]: "Y"
    })
  })

  it("should expose the members", () => {
    const schema = S.Union(S.String, S.Number)
    expect(schema.members).toStrictEqual([S.String, S.Number])
  })

  describe("decoding", () => {
    it("should use identifier annotations to generate a more informative error message when an incorrect data type is provided", async () => {
      const schema = S.Union(
        S.Struct({ a: S.String }).annotations({ identifier: "MyDataType1" }),
        S.Struct({ a: S.String }).annotations({ identifier: "MyDataType2" })
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        null,
        `MyDataType1 | MyDataType2
├─ Expected MyDataType1, actual null
└─ Expected MyDataType2, actual null`
      )
    })

    it("empty union", async () => {
      const schema = S.Union()
      await Util.expectDecodeUnknownFailure(schema, 1, "Expected never, actual 1")
    })

    it("members with literals but the input doesn't have any", async () => {
      const schema = S.Union(
        S.Struct({ a: S.Literal(1), c: S.String }),
        S.Struct({ b: S.Literal(2), d: S.Number })
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        null,
        `Expected { readonly a: 1; readonly c: string } | { readonly b: 2; readonly d: number }, actual null`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        {},
        `{ readonly a: 1; readonly c: string } | { readonly b: 2; readonly d: number }
├─ { readonly a: 1 }
│  └─ ["a"]
│     └─ is missing
└─ { readonly b: 2 }
   └─ ["b"]
      └─ is missing`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        { a: null },
        `{ readonly a: 1; readonly c: string } | { readonly b: 2; readonly d: number }
├─ { readonly a: 1 }
│  └─ ["a"]
│     └─ Expected 1, actual null
└─ { readonly b: 2 }
   └─ ["b"]
      └─ is missing`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        { b: 3 },
        `{ readonly a: 1; readonly c: string } | { readonly b: 2; readonly d: number }
├─ { readonly a: 1 }
│  └─ ["a"]
│     └─ is missing
└─ { readonly b: 2 }
   └─ ["b"]
      └─ Expected 2, actual 3`
      )
    })

    it("members with multiple tags", async () => {
      const schema = S.Union(
        S.Struct({ category: S.Literal("catA"), tag: S.Literal("a") }),
        S.Struct({ category: S.Literal("catA"), tag: S.Literal("b") }),
        S.Struct({ category: S.Literal("catA"), tag: S.Literal("c") })
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        null,
        `Expected { readonly category: "catA"; readonly tag: "a" } | { readonly category: "catA"; readonly tag: "b" } | { readonly category: "catA"; readonly tag: "c" }, actual null`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        {},
        `{ readonly category: "catA"; readonly tag: "a" } | { readonly category: "catA"; readonly tag: "b" } | { readonly category: "catA"; readonly tag: "c" }
├─ { readonly category: "catA" }
│  └─ ["category"]
│     └─ is missing
└─ { readonly tag: "b" | "c" }
   └─ ["tag"]
      └─ is missing`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        { category: null },
        `{ readonly category: "catA"; readonly tag: "a" } | { readonly category: "catA"; readonly tag: "b" } | { readonly category: "catA"; readonly tag: "c" }
├─ { readonly category: "catA" }
│  └─ ["category"]
│     └─ Expected "catA", actual null
└─ { readonly tag: "b" | "c" }
   └─ ["tag"]
      └─ is missing`
      )
      await Util.expectDecodeUnknownFailure(
        schema,
        { tag: "d" },
        `{ readonly category: "catA"; readonly tag: "a" } | { readonly category: "catA"; readonly tag: "b" } | { readonly category: "catA"; readonly tag: "c" }
├─ { readonly category: "catA" }
│  └─ ["category"]
│     └─ is missing
└─ { readonly tag: "b" | "c" }
   └─ ["tag"]
      └─ Expected "b" | "c", actual "d"`
      )
    })

    it("nested unions", async () => {
      const a = S.Struct({ _tag: S.Literal("a") }).annotations({ identifier: "a" })
      const b = S.Struct({ _tag: S.Literal("b") }).annotations({ identifier: "b" })
      const A = S.Struct({ a: S.Literal("A"), c: S.String }).annotations({ identifier: "A" })
      const B = S.Struct({ b: S.Literal("B"), d: S.Number }).annotations({ identifier: "B" })
      const ab = S.Union(a, b).annotations({ identifier: "ab" })
      const AB = S.Union(A, B).annotations({ identifier: "AB" })
      const schema = S.Union(ab, AB)
      await Util.expectDecodeUnknownSuccess(schema, { _tag: "a" })
      await Util.expectDecodeUnknownSuccess(schema, { _tag: "b" })
      await Util.expectDecodeUnknownSuccess(schema, { a: "A", c: "c" })
      await Util.expectDecodeUnknownSuccess(schema, { b: "B", d: 1 })
      await Util.expectDecodeUnknownFailure(
        schema,
        {},
        `ab | AB
├─ ab
│  └─ { readonly _tag: "a" | "b" }
│     └─ ["_tag"]
│        └─ is missing
└─ AB
   ├─ { readonly a: "A" }
   │  └─ ["a"]
   │     └─ is missing
   └─ { readonly b: "B" }
      └─ ["b"]
         └─ is missing`
      )
    })
  })

  describe("encoding", () => {
    it("union", async () => {
      const schema = S.Union(S.String, Util.NumberFromChar)
      await Util.expectEncodeSuccess(schema, "a", "a")
      await Util.expectEncodeSuccess(schema, 1, "1")
    })

    it("union/ exact optional property signatures", async () => {
      const ab = S.Struct({ a: S.String, b: S.optionalWith(S.Number, { exact: true }) })
      const ac = S.Struct({ a: S.String, c: S.optionalWith(S.Number, { exact: true }) })
      const schema = S.Union(ab, ac)
      await Util.expectEncodeSuccess(
        schema,
        { a: "a", c: 1 },
        { a: "a" }
      )
      await Util.expectEncodeSuccess(
        schema,
        { a: "a", c: 1 },
        { a: "a", c: 1 },
        Util.onExcessPropertyError
      )
    })
  })
})
