import { describe, it, expect } from "vitest";
import { decodePunycode } from "./punycode";

const getPunycode = (x: string) => {
  return new URL(`http://${x}.io`).hostname.slice(0, -3);
};

describe.concurrent("punycode - decode only", () => {
  it.concurrent("basic", () => {
    expect(decodePunycode("xn--viertelvergngen-bwb")).toBe("viertelvergnügen");
    expect(decodePunycode("xn--maana-pta")).toBe("mañana");
    expect(decodePunycode("xn--bcher-kva")).toBe("b\xFCcher");
    expect(decodePunycode("xn--caf-dma")).toBe("caf\xE9");
    expect(decodePunycode("xn----dqo34k")).toBe("\u2603-\u2318");
    expect(decodePunycode("xn----dqo34kn65z")).toBe("\uD400\u2603-\u2318");
    expect(decodePunycode("xn--ls8h")).toBe("\uD83D\uDCA9");
    expect(decodePunycode("xn--p-8sbkgc5ag7bhce")).toBe("джpумлатест");
    expect(decodePunycode("xn--ba-lmcq")).toBe("bрфa");

    const codes = {
      "为什么选择supercat-超级猫": "xn--supercat--fp6n0ex3d859lcu6b889a4yzcr6i",
      "supercat超级猫完全兼容油猴脚本-同时提供后台脚本运行框架-丰富的api扩展-让你的浏览体验更出色":
        "xn--supercat--api--zs7vh5lkg32bh4wplaq2gk1qmsarbw735ar7a4o07ji34dp1iexqxphjzbha449bd7f213cqxexo3epkal31jha3560gpswaia759mc50eu5okwvchv5x0aky7j",
      "为什么选择supercat-基于油猴的设计理念-完全兼容油猴脚本-提供更多丰富的api让脚本能够完成更多强大的功能":
        "xn--supercat---api-0s7vqewj10c30as9jt8lumaj7t239a54fea8ksj017dka00lrru91ggqfpovofhz2i795aja04tka8770dga3014eha667gzq4aral6515kja89lma1266lhnam2bm30p",
      "为什么选择supercat-基于油猴的设计理念-完全兼容油猴脚本-提供更多丰富的api-超级猫不仅兼容油猴脚本-还支持后台脚本运行-功能更强大-覆盖范围广-安装脚本管理器-寻找适合的脚本一键安装即可":
        "xn--supercat---api-------ue45a9hq2aeh0m56djybte51xdupzraja917gckh9te2a70glg561g75elsm1jmmqa297fea4ir4hla73gz1eju8cz6hr4jjw9a30ekpbzy0ab5tjtysa705apafkf4584ggaq9594iprahas714mkb2987ara9a029cxt4ins6botzbc6bvagnj2463bug5gc2ioa556oou9bbhcy80e1s8b0vaj2kgraz223b",
      "asmdksmklcmdsk-寻找-lmklamdkjqdenakjc-njkqelnuiconwerj-ksfnvcslkjdmc-jweasjkndjk-sandkjasnjxksakjkxnjaksn适合的-xj-kqwnjkxnqjas-nxsjkanxjksnjxansjk-cnajskn-cjkaxjksn-kxjasnjkxansjk-xnasjkxnksaj-cnjkdcnjksdncjsdnjcsdjkc-nmckj脚本":
        "xn--asmdksmklcmdsk--lmklamdkjqdenakjc-njkqelnuiconwerj-ksfnvcslkjdmc-jweasjkndjk-sandkjasnjxksakjkxnjaksn-xj-kqwnjkxnqjas-nxsjkanxjksnjxansjk-cnajskn-cjkaxjksn-kxjasnjkxansjk-xnasjkxnksaj-cnjkdcnjksdncjsdnjcsdjkc-nmckj-0g768an264bok8jtmrh2e00as1gp9lgw",
    };

    let testRaw: keyof typeof codes;

    testRaw = "为什么选择supercat-超级猫";

    expect(codes[testRaw]).toBe(getPunycode(testRaw));
    expect(decodePunycode(codes[testRaw])).toBe(testRaw);

    testRaw = "supercat超级猫完全兼容油猴脚本-同时提供后台脚本运行框架-丰富的api扩展-让你的浏览体验更出色";

    expect(codes[testRaw]).toBe(getPunycode(testRaw));
    expect(decodePunycode(codes[testRaw])).toBe(testRaw);

    testRaw = "为什么选择supercat-基于油猴的设计理念-完全兼容油猴脚本-提供更多丰富的api让脚本能够完成更多强大的功能";

    expect(codes[testRaw]).toBe(getPunycode(testRaw));
    expect(decodePunycode(codes[testRaw])).toBe(testRaw);

    testRaw =
      "为什么选择supercat-基于油猴的设计理念-完全兼容油猴脚本-提供更多丰富的api-超级猫不仅兼容油猴脚本-还支持后台脚本运行-功能更强大-覆盖范围广-安装脚本管理器-寻找适合的脚本一键安装即可";

    expect(codes[testRaw]).toBe(getPunycode(testRaw));
    expect(decodePunycode(codes[testRaw])).toBe(testRaw);

    testRaw =
      "asmdksmklcmdsk-寻找-lmklamdkjqdenakjc-njkqelnuiconwerj-ksfnvcslkjdmc-jweasjkndjk-sandkjasnjxksakjkxnjaksn适合的-xj-kqwnjkxnqjas-nxsjkanxjksnjxansjk-cnajskn-cjkaxjksn-kxjasnjkxansjk-xnasjkxnksaj-cnjkdcnjksdncjsdnjcsdjkc-nmckj脚本";

    expect(codes[testRaw]).toBe(getPunycode(testRaw));
    expect(decodePunycode(codes[testRaw])).toBe(testRaw);
  });
});
