export interface Encoding {
  ids: number[];
  tokens: string[];
  offsets: Array<[number,number]>;
  attention_mask: number[];
  token_type_ids?: number[];
}
