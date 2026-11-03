import { describe, expect, it } from "vitest";
import { directoryCategories } from "./directory";
import type { Category } from "../data";

describe("directoryCategories", () => {
  const sampleCategories: Category[] = [
    {
      id: 1,
      name: "开发",
      description: "开发者常用工具",
      icon: "code",
      links: [
        { id: 101, name: "GitHub", description: "代码托管平台", url: "https://github.com", icon: "github", categoryId: 1, visible: true },
        { id: 102, name: "Vercel", description: "部署平台", url: "https://vercel.com", icon: "vercel", categoryId: 1, visible: true },
      ],
    },
    {
      id: 2,
      name: "设计",
      description: "设计灵感与工具",
      icon: "palette",
      links: [
        { id: 201, name: "Figma", description: "协同界面设计", url: "https://figma.com", icon: "figma", categoryId: 2, visible: true },
      ],
    },
  ];

  it("returns original category reference when query is empty and all links are visible", () => {
    const result = directoryCategories(sampleCategories);
    expect(result.length).toBe(2);
    expect(result[0]).toBe(sampleCategories[0]);
    expect(result[1]).toBe(sampleCategories[1]);
  });

  it("creates a new category object when some links inside are hidden", () => {
    const categoriesWithHiddenLink: Category[] = [
      {
        ...sampleCategories[0],
        links: [
          sampleCategories[0].links[0],
          { ...sampleCategories[0].links[1], visible: false },
        ],
      },
    ];

    const result = directoryCategories(categoriesWithHiddenLink, "");
    expect(result[0]).not.toBe(categoriesWithHiddenLink[0]);
    expect(result[0].links.length).toBe(1);
    expect(result[0].links[0].id).toBe(101);
  });

  it("filters correctly by query and creates new category objects", () => {
    const result = directoryCategories(sampleCategories, "github");
    expect(result.length).toBe(1);
    expect(result[0]).not.toBe(sampleCategories[0]);
    expect(result[0].name).toBe("开发");
    expect(result[0].links.length).toBe(1);
    expect(result[0].links[0].name).toBe("GitHub");
  });

  it("filters matching by description and url", () => {
    const resultByDesc = directoryCategories(sampleCategories, "协同界面");
    expect(resultByDesc.length).toBe(1);
    expect(resultByDesc[0].name).toBe("设计");

    const resultByUrl = directoryCategories(sampleCategories, "vercel.com");
    expect(resultByUrl.length).toBe(1);
    expect(resultByUrl[0].name).toBe("开发");
    expect(resultByUrl[0].links[0].name).toBe("Vercel");
  });

  it("excludes hidden categories completely", () => {
    const hiddenCategory: Category = {
      ...sampleCategories[0],
      visible: false,
    };
    const result = directoryCategories([hiddenCategory, sampleCategories[1]], "");
    expect(result.length).toBe(1);
    expect(result[0]).toBe(sampleCategories[1]);
  });
});
