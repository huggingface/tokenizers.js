import fetchConfigById from "./utils/fetchConfigById";
import { Tokenizer } from "../src";

describe("Memory leak tests", () => {
  it("should not leak memory", async () => {
    expect(global.gc).toBeDefined();
    const modelId = "TinyLlama/TinyLlama-1.1B-Chat-v1.0";
    const { tokenizerJson, tokenizerConfig } = await fetchConfigById(modelId);
    const tokenizer = new Tokenizer(tokenizerJson, tokenizerConfig);

    // NB: Force garbage collection before measuring memory usage
    global.gc!();
    const startMemory = process.memoryUsage().heapUsed;
    for (let i = 0; i < 2500; ++i) {
      const s = `${i} ${i} `.repeat(i);
      tokenizer.encode(s);
    }
    global.gc!();
    const endMemory = process.memoryUsage().heapUsed;
    const memoryUsed = endMemory - startMemory;
    const memoryLimit = 1024 * 1024; // 1 MB
    expect(memoryUsed).toBeLessThan(memoryLimit);
  }, 30000); // Increase timeout to accommodate the memory leak test

  describe("should not retain the vocabulary and merges of the tokenizer JSON", () => {
    // Each entry returns the model of a tokenizer JSON, and the parts of it that must not outlive the JSON.
    const MODELS: Record<string, () => { model: any; parts: object[] }> = {
      "BPE (merges as pairs)": () => {
        const model = { type: "BPE", unk_token: "<unk>", vocab: { "<unk>": 0, a: 1, b: 2, ab: 3 }, merges: [["a", "b"]] };
        return { model, parts: [model, model.vocab, model.merges, model.merges[0]] };
      },
      "BPE (merges as strings)": () => {
        const model = { type: "BPE", unk_token: "<unk>", vocab: { "<unk>": 0, a: 1, b: 2, ab: 3 }, merges: ["a b"] };
        return { model, parts: [model, model.vocab, model.merges] };
      },
      WordPiece: () => {
        const model = { type: "WordPiece", unk_token: "[UNK]", continuing_subword_prefix: "##", vocab: { "[UNK]": 0, a: 1, "##b": 2, ab: 3 } };
        return { model, parts: [model, model.vocab] };
      },
      Unigram: () => {
        const model = {
          type: "Unigram",
          unk_id: 0,
          vocab: [
            ["<unk>", 0],
            ["a", -1],
            ["b", -1],
            ["ab", -0.5],
          ],
        };
        return { model, parts: [model, model.vocab, model.vocab[3]] };
      },
      Legacy: () => {
        const model = { vocab: { "<unk>": 0, ab: 1 } };
        return { model, parts: [model, model.vocab] };
      },
    };

    for (const [name, create_model] of Object.entries(MODELS)) {
      it(name, async () => {
        expect(global.gc).toBeDefined();

        const create = () => {
          const { model, parts } = create_model();
          const tokenizerJson: Record<string, unknown> = { added_tokens: [], normalizer: null, pre_tokenizer: null, post_processor: null, decoder: null, model };
          const tokenizer = new Tokenizer(tokenizerJson, { unk_token: "<unk>" });
          return { tokenizer, refs: parts.map((part) => new WeakRef(part)) };
        };
        const { tokenizer, refs } = create();

        // NB: The target of a new WeakRef is kept alive until the end of the current job
        await new Promise((resolve) => setTimeout(resolve, 0));
        global.gc!();

        expect(refs.map((ref) => ref.deref() === undefined)).toEqual(refs.map(() => true));
        expect(tokenizer.encode("ab").tokens).toEqual(["ab"]);
      });
    }
  });
});
