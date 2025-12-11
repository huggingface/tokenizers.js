export type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array;

export type BigTypedArray = BigInt64Array | BigUint64Array;

export type AnyTypedArray = TypedArray | BigTypedArray;

export type DataArray = AnyTypedArray | any[];

export type DataType =
  | "float32"
  | "float16"
  | "float64"
  | "string"
  | "int8"
  | "uint8"
  | "int16"
  | "uint16"
  | "int32"
  | "uint32"
  | "int64"
  | "uint64"
  | "bool"
  | "uint4"
  | "int4";

export interface Encoding {
  ids: number[];
  tokens: string[];
  attention_mask: number[];
  token_type_ids?: number[];
  offset_mapping?: Array<[number, number]>;
}
