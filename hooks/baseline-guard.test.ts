import { describe, expect, test } from "bun:test";
import {
  BRANCH_DENIAL,
  BUILD_DENIAL,
  BUILD_DENIAL_WITHOUT_REVIEW,
  DIRECTORY_DENIAL,
  FILE_DENIAL,
} from "../src/baseline-policy";
import { baselineDenial } from "./baseline-guard";

describe("baseline other branches", () => {
  test("denies listing refs and history wider than HEAD", () => {
    expect(baselineDenial("git branch")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git branch -a")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git -C /abs/src branch --list")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git for-each-ref refs/heads")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git show-ref")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git reflog")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git log --all --oneline")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git --no-pager log --branches=dino*")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git log -g")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git rev-list --all | head")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git show HEAD@{3}")).toBe(BRANCH_DENIAL);
    expect(baselineDenial('git -C "$PWD" log --all')).toBe(BRANCH_DENIAL);
  });

  test("denies naming a run branch or reading the ref files", () => {
    expect(baselineDenial("git checkout dino-hat__baseline__r0__mvnh9apl")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git diff HEAD dino-hat__baseline__r0__mvnh9apl -- a.cc")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("git log refs/heads/main")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("cat .git/packed-refs")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("ls /abs/src/.git/refs/heads")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("bash -c 'git branch -a'")).toBe(BRANCH_DENIAL);
    expect(baselineDenial("echo $(git reflog)")).toBe(BRANCH_DENIAL);
  });

  test("allows the current branch, HEAD history, and unrelated uses of the same words", () => {
    expect(baselineDenial("git branch --show-current")).toBeNull();
    expect(baselineDenial("git log --oneline -3 -- components/neterror")).toBeNull();
    expect(baselineDenial("git show --stat HEAD~2")).toBeNull();
    expect(baselineDenial("git status --short")).toBeNull();
    expect(baselineDenial("git grep --all-match -e one -e two")).toBeNull();
    expect(baselineDenial("git add --all")).toBeNull();
    expect(baselineDenial("grep -r refs/heads tools")).toBeNull();
    expect(baselineDenial("grep -rn '@{' tools")).toBeNull();
  });
});

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

describe("baseline local builds", () => {
  test("denies gn, ninja, autoninja, and siso, including a path and a wrapper", () => {
    expect(baselineDenial("ninja -C out/Default chrome")).toBe(BUILD_DENIAL);
    expect(baselineDenial("autoninja -C out/Default chrome")).toBe(BUILD_DENIAL);
    expect(baselineDenial("gn gen out/Default")).toBe(BUILD_DENIAL);
    expect(baselineDenial("siso ninja -C out/Default chrome")).toBe(BUILD_DENIAL);
    expect(baselineDenial("/abs/depot_tools/autoninja -C out/Default chrome")).toBe(BUILD_DENIAL);
    expect(baselineDenial("sudo -n ninja -C out/Default chrome")).toBe(BUILD_DENIAL);
    expect(baselineDenial("bash -c 'gn gen out/Default'")).toBe(BUILD_DENIAL);
  });

  test("omits the chrome-validate hint when auto review is off", () => {
    const previous = process.env.BENCH_AUTO_REVIEW;
    process.env.BENCH_AUTO_REVIEW = "0";

    try {
      expect(baselineDenial("ninja -C out/Default chrome")).toBe(BUILD_DENIAL_WITHOUT_REVIEW);
    } finally {
      if (previous == null) {
        delete process.env.BENCH_AUTO_REVIEW;
      } else {
        process.env.BENCH_AUTO_REVIEW = previous;
      }
    }
  });

  test("allows mentioning the tools without running them", () => {
    expect(baselineDenial("echo ninja")).toBeNull();
    expect(baselineDenial("ls third_party/ninja")).toBeNull();
    expect(baselineDenial("command -v ninja")).toBeNull();
  });
});
