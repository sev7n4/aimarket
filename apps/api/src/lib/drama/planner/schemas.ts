const characterVisualSignature = {
  type: "object",
  required: [
    "ageRange",
    "faceShape",
    "eyeShape",
    "hairStyle",
    "skinTone",
    "signatureOutfit",
  ],
  properties: {
    ageRange: { type: "string" },
    faceShape: { type: "string" },
    eyeShape: { type: "string" },
    hairStyle: { type: "string" },
    skinTone: { type: "string" },
    signatureOutfit: { type: "string" },
    distinguishingFeatures: { type: "array", items: { type: "string" } },
  },
};

export const WRITER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "logline", "acts", "narratorLines", "scenes", "shots"],
  properties: {
    title: { type: "string" },
    logline: { type: "string" },
    acts: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["act", "sceneId", "summary"],
        properties: {
          act: { type: "number" },
          sceneId: { type: "string" },
          summary: { type: "string" },
          emotion: { type: "string" },
        },
      },
    },
    narratorLines: { type: "array", items: { type: "string" } },
    scenes: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["id", "name", "location", "atmosphere", "promptAnchor"],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          location: { type: "string" },
          era: { type: "string" },
          atmosphere: { type: "string" },
          props: { type: "array", items: { type: "string" } },
          promptAnchor: { type: "string" },
        },
      },
    },
    shots: {
      type: "array",
      minItems: 8,
      maxItems: 15,
      items: {
        type: "object",
        required: ["id", "order", "sceneId", "characterIds", "dialogue"],
        properties: {
          id: { type: "string" },
          order: { type: "number" },
          sceneId: { type: "string" },
          characterIds: { type: "array", items: { type: "string" } },
          dialogue: {
            type: "array",
            items: {
              type: "object",
              required: ["characterId", "line"],
              properties: {
                characterId: { type: "string" },
                line: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

export const DIRECTOR_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["styleBible"],
  properties: {
    styleBible: {
      type: "object",
      required: ["palette", "lightingStyle", "aspectRatio", "negativePrompt"],
      properties: {
        palette: { type: "array", items: { type: "string" }, minItems: 2 },
        lightingStyle: { type: "string" },
        filmGrain: { type: "string" },
        aspectRatio: { type: "string", enum: ["9:16", "16:9"] },
        negativePrompt: { type: "string" },
      },
    },
    productionNotes: { type: "string" },
  },
};

export const CHARACTER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["characters"],
  properties: {
    characters: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        required: [
          "id",
          "name",
          "personalityTone",
          "visualSignature",
          "promptAnchor",
        ],
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          role: { type: "string" },
          personalityTone: { type: "string" },
          voiceStyle: { type: "string" },
          promptAnchor: { type: "string" },
          visualSignature: characterVisualSignature,
        },
      },
    },
  },
};

export const CINEMATOGRAPHER_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shots"],
  properties: {
    shots: {
      type: "array",
      minItems: 8,
      maxItems: 15,
      items: {
        type: "object",
        required: ["id", "cameraSpec", "motionPrompt"],
        properties: {
          id: { type: "string" },
          cameraSpec: {
            type: "object",
            required: ["shotSize", "movement", "lighting"],
            properties: {
              shotSize: { type: "string" },
              movement: { type: "string" },
              lighting: { type: "string" },
              colorTemp: { type: "string" },
            },
          },
          motionPrompt: { type: "string" },
        },
      },
    },
  },
};

export const STORYBOARD_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["shots"],
  properties: {
    shots: {
      type: "array",
      minItems: 8,
      maxItems: 15,
      items: {
        type: "object",
        required: [
          "id",
          "order",
          "sceneId",
          "characterIds",
          "visualPrompt",
          "motionPrompt",
          "cameraSpec",
          "durationSec",
        ],
        properties: {
          id: { type: "string" },
          order: { type: "number" },
          sceneId: { type: "string" },
          characterIds: { type: "array", items: { type: "string" } },
          dialogue: {
            type: "array",
            items: {
              type: "object",
              required: ["characterId", "line"],
              properties: {
                characterId: { type: "string" },
                line: { type: "string" },
              },
            },
          },
          visualPrompt: { type: "string" },
          motionPrompt: { type: "string" },
          durationSec: { type: "number" },
          useLastFrameContinuity: { type: "boolean" },
          cameraSpec: {
            type: "object",
            required: ["shotSize", "movement", "lighting"],
            properties: {
              shotSize: { type: "string" },
              movement: { type: "string" },
              lighting: { type: "string" },
              colorTemp: { type: "string" },
            },
          },
        },
      },
    },
  },
};
