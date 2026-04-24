/**
 * Probe available NVIDIA NIM models.
 * Run: NVIDIA_API_KEY=<your-key> node tests/probe-models.mjs
 */

const API_KEY = process.env.NVIDIA_API_KEY ?? "";

if (!API_KEY) {
  console.error("❌ NVIDIA_API_KEY environment variable is not set.");
  process.exit(1);
}

fetch("https://integrate.api.nvidia.com/v1/models", {
  headers: { "Authorization": `Bearer ${API_KEY}` }
})
  .then((r) => r.json())
  .then((j) => {
    const models = j.data || [];
    const embeddingModels = models.filter((m) =>
      m.id.toLowerCase().includes("embed")
    );
    console.log("Total models:", models.length);
    console.log("Embedding models:", JSON.stringify(embeddingModels.map((m) => m.id), null, 2));
  })
  .catch((e) => console.error(e));
