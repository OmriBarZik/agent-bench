import { describe, expect, test } from "bun:test";
import { DIRECTORY_DENIAL, FILE_DENIAL } from "../src/baseline-policy";
import { baselineDenial } from "./baseline-guard";

describe("baseline directory changes", () => {
  test("denies cd, including compounds, subshells, and substitutions", () => {
    expect(baselineDenial("cd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("cd /tmp && ls")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("ls && cd chrome")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("(cd /tmp && ls)")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("echo $(cd /tmp && pwd)")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("cd&&ls")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("pushd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("popd")).toBe(DIRECTORY_DENIAL);
  });

  test("denies cd hidden in wrappers and bash -c", () => {
    expect(baselineDenial("builtin cd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("sudo -n cd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("env FOO=1 cd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("timeout 30 cd /tmp")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("bash -c 'cd /tmp && ls'")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("bash -lc 'cd /tmp'")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("bash <<EOF\ncd /tmp\nEOF")).toBe(DIRECTORY_DENIAL);
    expect(baselineDenial("python3 -c 'import os; os.chdir(\"/tmp\")'")).toBe(DIRECTORY_DENIAL);
  });

  test("allows git -C, a stable relative path, and cd mentioned as text", () => {
    expect(baselineDenial("git -C /abs/path status")).toBeNull();
    expect(baselineDenial("git status")).toBeNull();
    expect(baselineDenial("ls chrome/browser")).toBeNull();
    expect(baselineDenial("ninja -C out/Default chrome")).toBeNull();
    expect(baselineDenial("echo cd")).toBeNull();
    expect(baselineDenial("echo hello # cd /tmp")).toBeNull();
    expect(baselineDenial("command -v cd")).toBeNull();
  });
});

describe("baseline shell file edits", () => {
  test("denies redirection, in-place editors, tee, patch, and inline writers", () => {
    expect(baselineDenial("echo hi > file.txt")).toBe(FILE_DENIAL);
    expect(baselineDenial("echo hi >> file.txt")).toBe(FILE_DENIAL);
    expect(baselineDenial("cat > file << EOF\nhello\nEOF")).toBe(FILE_DENIAL);
    expect(baselineDenial("sed -i 's/a/b/' file")).toBe(FILE_DENIAL);
    expect(baselineDenial("sed -i.bak 's/a/b/' file")).toBe(FILE_DENIAL);
    expect(baselineDenial("perl -pi -e 's/a/b/' file")).toBe(FILE_DENIAL);
    expect(baselineDenial("tee out.txt")).toBe(FILE_DENIAL);
    expect(baselineDenial("make | tee build.log")).toBe(FILE_DENIAL);
    expect(baselineDenial("vim file")).toBe(FILE_DENIAL);
    expect(baselineDenial("patch -p1 < fix.patch")).toBe(FILE_DENIAL);
    expect(baselineDenial("git apply patch.diff")).toBe(FILE_DENIAL);
    expect(baselineDenial("git -C /abs apply foo.patch")).toBe(FILE_DENIAL);
    expect(baselineDenial('python3 -c \'open("a","w").write("x")\'')).toBe(FILE_DENIAL);
    expect(baselineDenial('python3 - <<PY\nopen("a","w").write("x")\nPY')).toBe(FILE_DENIAL);
    expect(baselineDenial("find . -exec sed -i s/a/b/ {} \\;")).toBe(FILE_DENIAL);
    expect(baselineDenial("xargs sed -i s/a/b/ file")).toBe(FILE_DENIAL);
  });

  test("allows reading, discarding output, and git inspection", () => {
    expect(baselineDenial("ls > /dev/null")).toBeNull();
    expect(baselineDenial("ls 2>/dev/null")).toBeNull();
    expect(baselineDenial("ls 2>&1")).toBeNull();
    expect(baselineDenial("echo hi &>/dev/null")).toBeNull();
    expect(baselineDenial("tee")).toBeNull();
    expect(baselineDenial("sed -n 's/a/b/p' file")).toBeNull();
    expect(baselineDenial("perl -ne 'print' file")).toBeNull();
    expect(baselineDenial("python3 -c 'print(open(\"a\").read())'")).toBeNull();
    expect(baselineDenial("git diff")).toBeNull();
    expect(baselineDenial("git status")).toBeNull();
  });
});
