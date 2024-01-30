import StyleDictionary from "style-dictionary";
import fs from "fs";

const SUPER_NAME_MANAGER = {
  isSystemLightThemeColor: "isSystemLightThemeColor",
  isSystemDarkThemeColor: "isSystemDarkThemeColor",
  isRefColor: "isRefColor",
  isTypography: "isTypography",
  formatSystemColor: "formatSystemColor",
  formatRefColor: "formatRefColor",
  formatTypography: "formatTypography",
};

const FontWeightMap = {
  thin: 100,
  extralight: 200,
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
  extrabold: 800,
  black: 900,
};

main();

function main() {
  registerFilters();
  registerFormats();
  buildDesignTokens();
  generateIndexFiles();
}

/**
 * Style-Dictionary에 설정 값을 집어 넣어 RN 호환용 토큰을 빌드하는 함수
 */
function buildDesignTokens() {
  StyleDictionary.extend({
    source: ["./tokens/**/*.json"],
    platforms: {
      // original: {
      //   transformGroup: "react-native",
      //   buildPath: "src/styles/design-tokens/",
      //   files: [{ destination: "m3.js", format: "javascript/es6" }],
      // },
      systemColor: {
        transformGroup: "react-native",
        buildPath: "src/styles/design-tokens/color/sys/",
        files: [
          {
            destination: "lightTheme.ts",
            format: SUPER_NAME_MANAGER.formatSystemColor,
            filter: SUPER_NAME_MANAGER.isSystemLightThemeColor,
          },
          {
            destination: "darkTheme.ts",
            format: SUPER_NAME_MANAGER.formatSystemColor,
            filter: SUPER_NAME_MANAGER.isSystemDarkThemeColor,
          },
        ],
      },
      referenceColor: {
        transformGroup: "react-native",
        buildPath: "src/styles/design-tokens/color/ref/",
        files: [
          {
            destination: "index.ts",
            filter: SUPER_NAME_MANAGER.isRefColor,
            format: SUPER_NAME_MANAGER.formatRefColor,
          },
        ],
      },
      typography: {
        transformGroup: "react-native",
        buildPath: "src/styles/design-tokens/typography/",
        files: [
          {
            destination: "index.ts",
            filter: SUPER_NAME_MANAGER.isTypography,
            format: SUPER_NAME_MANAGER.formatTypography,
          },
        ],
      },
    },
  }).buildAllPlatforms();
}

/**
 * Style-Dictionary Custom Filter들을 등록하는 함수
 */
function registerFilters() {
  StyleDictionary.registerFilter({
    name: SUPER_NAME_MANAGER.isSystemLightThemeColor,
    matcher: ({ name }) => {
      const TARGET_NAME = "syslight";
      return name.trim().toLowerCase().includes(TARGET_NAME);
    },
  });

  StyleDictionary.registerFilter({
    name: SUPER_NAME_MANAGER.isSystemDarkThemeColor,
    matcher: ({ name }) => {
      const TARGET_NAME = "sysdark";
      return name.trim().toLowerCase().includes(TARGET_NAME);
    },
  });

  StyleDictionary.registerFilter({
    name: SUPER_NAME_MANAGER.isRefColor,
    matcher: (token) => {
      return token.name.trim().toLowerCase().includes("ref");
    },
  });

  StyleDictionary.registerFilter({
    name: SUPER_NAME_MANAGER.isTypography,
    matcher: ({ type }) => {
      return type === "typography";
    },
  });
}

/**
 * Style-Dictionary Custom Formatter들을 등록하는 함수
 */
function registerFormats() {
  StyleDictionary.registerFormat({
    name: SUPER_NAME_MANAGER.formatSystemColor,
    formatter: ({ dictionary }) => {
      return dictionary.allTokens
        .map((token) => {
          const parsedName = token.name
            .replace("m3", "")
            .replace("Sys", "")
            .replace("Light", "")
            .replace("Dark", "");

          const constantName = `${parsedName
            .slice(0, 1)
            .toLowerCase()}${parsedName.slice(1)}`;

          return `export const ${constantName} = "${token.value}" as const;`;
        })
        .join("\n");
    },
  });

  StyleDictionary.registerFormat({
    name: SUPER_NAME_MANAGER.formatRefColor,
    formatter: ({ dictionary }) => {
      let totalResult = ``;

      const colorList = [
        ...new Set(
          dictionary.allTokens.map((token) => {
            return token.path[2];
          })
        ),
      ];

      colorList.forEach((color) => {
        const tokens = dictionary.allTokens.filter((token) =>
          token.path.map((pathName) => pathName.toLowerCase()).includes(color)
        );

        let result = `export const ${toCamelCase(color)} = {`;

        const tokenResult = tokens.map((token) => {
          const name = (token.name.match(/\d+/g) || []).at(-1);
          return `\n${name}: "${token.value}"`;
        });

        result += `${tokenResult}\n} as const\n\n`;
        totalResult += result;
      });

      return totalResult;
    },
  });

  StyleDictionary.registerFormat({
    name: SUPER_NAME_MANAGER.formatTypography,
    formatter: ({ dictionary }) => {
      function parseTypographyInfo(typographyInfo) {
        let valueObj = typographyInfo.value;
        const result = {};

        if (typeof valueObj === "object") {
          if ("fontFamily" in valueObj) {
            result["fontFamily"] = valueObj["fontFamily"];
          }

          if ("fontWeight" in valueObj) {
            const fontWeightValue = valueObj["fontWeight"];
            result["fontWeight"] = `${
              FontWeightMap[fontWeightValue.toLowerCase()]
            }`;
          }

          if ("lineHeight" in valueObj) {
            result["lineHeight"] = parseInt(valueObj["lineHeight"], 10);
          }

          if ("fontSize" in valueObj) {
            result["fontSize"] = parseInt(valueObj["fontSize"], 10);
          }

          // TODO: letterSpacing RN에서 어떻게 처리 하는지 체크하기
        }

        return JSON.stringify(result, null, 2);
      }

      function buildTypographyValue(groupTypographies) {
        if (typeof groupTypographies !== "object") {
          return "";
        }

        const contents = Object.entries(groupTypographies)
          .map(([typographyName, typoGraphyInfo]) => {
            return `${toCamelCase(typographyName)}: ${parseTypographyInfo(
              typoGraphyInfo
            )},`;
          })
          .join("\n");

        return contents;
      }

      const m3TypographyTokens = dictionary.tokens["M3"];
      const typographyContents = Object.entries(m3TypographyTokens).map(
        ([groupName, groupTypographies]) => {
          return `export const ${groupName} = {\n${buildTypographyValue(
            groupTypographies
          )}\n} as const\n`;
        }
      );

      return typographyContents.join("\n");
    },
  });
}

/**
 * Style-Dictionary로 생성하기 애매한 index.ts 파일들을 생성하는 함수
 */
function generateIndexFiles() {
  const basePath = "src/styles/design-tokens";
  const fileList = [
    {
      path: `${basePath}/color/index.ts`,
      content: `export * as SystemLightColor from "./sys/lightTheme";
      export * as SystemDarkColor from "./sys/darkTheme";
      export * as ReferenceColor from "./ref";`,
    },
    {
      path: `${basePath}/index.ts`,
      content: `export * from "./color"
    export * as Typography from "./typography"`,
    },
  ];

  try {
    fileList.forEach(({ path, content }) => fs.writeFileSync(path, content));
  } catch (error) {
    console.error(`파일 생성 중 오류 발생: ${error.message}`);
  }
}

/**
 * 인자로 받은 문자열을 카멜케이스로 변경하는 헬퍼 함수
 * @param {string} input
 * @returns string
 */
function toCamelCase(input) {
  return input
    .replace(/-(.)/g, (_, nextChar) => nextChar.toUpperCase())
    .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => {
      return index === 0 ? word.toLowerCase() : word.toUpperCase();
    })
    .replace(/\s+/g, "");
}

/**
 * letterSpacing에 % 값이 들어오면 fontSize에 맞춰 숫자 값으로 변환 해주는 헬퍼 함수.
 * @param {string} percentValue
 * @param {number} originalValue
 * @returns
 */
function calcPercentToNumber(percentValue, originalValue) {
  let percentNumberValue = 0;

  if (typeof percentValue === "string" && percentValue.includes("%")) {
    const percentIndex = percentValue.indexOf("%");
    if (percentIndex > -1) {
      percentNumberValue = parseFloat(percentValue.slice(0, percentIndex));
    }
  }

  if (!isNaN(percentNumberValue) && !isNaN(originalValue)) {
    return (percentNumberValue * (originalValue / 100)).toFixed(3);
  }

  return 0;
}
