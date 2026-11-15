#!/usr/bin/env bash
set -euo pipefail
project_dir="$(cd "$(dirname "$0")/.." && pwd)"
build_dir="${LAB_BUILD_DIR:-$project_dir/.build}"
mkdir -p "$build_dir"
mp_dir="$build_dir/micropython-1.29.0"
sdk_dir="$build_dir/emsdk-4.0.15"
if [ ! -d "$mp_dir" ]; then
    curl -fL https://codeload.github.com/micropython/micropython/tar.gz/refs/tags/v1.29.0 -o "$build_dir/micropython.tar.gz"
    printf '%s  %s\n' 8072f6ad42c0e3bbfca88ed09bf8f1106ce207a39129af920f70081b8f2fe286 "$build_dir/micropython.tar.gz" | sha256sum -c -
    tar -xzf "$build_dir/micropython.tar.gz" -C "$build_dir"
fi
if [ ! -d "$sdk_dir" ]; then
    curl -fL https://codeload.github.com/emscripten-core/emsdk/tar.gz/refs/tags/4.0.15 -o "$build_dir/emsdk.tar.gz"
    printf '%s  %s\n' 35be7626493e3bd22860ee2177147f9bca3b6ff871edeab27c5b061a9ed9d23d "$build_dir/emsdk.tar.gz" | sha256sum -c -
    tar -xzf "$build_dir/emsdk.tar.gz" -C "$build_dir"
fi
python3 "$sdk_dir/emsdk.py" install 4.0.15
python3 "$sdk_dir/emsdk.py" activate 4.0.15
source "$sdk_dir/emsdk_env.sh"
# Fixed build date; the v0.0.1 prototype was produced on 2026-11-12 UTC.
export SOURCE_DATE_EPOCH=1794441600
python3 "$project_dir/scripts/patch-runtime.py" "$mp_dir"
make -C "$mp_dir/ports/webassembly" VARIANT=lab clean
make -C "$mp_dir/ports/webassembly" VARIANT=lab -j"${LAB_BUILD_JOBS:-4}"
mkdir -p "$project_dir/public/runtime" "$project_dir/public/licenses"
cp "$mp_dir/ports/webassembly/build-lab/micropython.mjs" "$mp_dir/ports/webassembly/build-lab/micropython.wasm" "$project_dir/public/runtime/"
python3 "$project_dir/scripts/patch-radio-runtime.py"
cp "$mp_dir/LICENSE" "$project_dir/public/licenses/MicroPython-MIT.txt"
cp "$sdk_dir/upstream/emscripten/LICENSE" "$project_dir/public/licenses/Emscripten-LICENSE.txt"
cp "$sdk_dir/upstream/emscripten/system/lib/libc/musl/COPYRIGHT" "$project_dir/public/licenses/musl-COPYRIGHT.txt"
cp "$sdk_dir/upstream/emscripten/system/lib/compiler-rt/LICENSE.TXT" "$project_dir/public/licenses/compiler-rt-LICENSE.txt"
cd "$project_dir"
sha256sum public/runtime/micropython.mjs public/runtime/micropython.wasm > runtime/SHA256SUMS
