TREE_SITTER ?= tree-sitter
NVIM ?= nvim
CACHE_DIR := $(CURDIR)/build/cache

.PHONY: generate build test test-corpus test-neovim test-rust clean

generate:
	$(TREE_SITTER) generate --abi 15

build:
	mkdir -p parser
	XDG_CACHE_HOME="$(CACHE_DIR)" $(TREE_SITTER) build --output parser/verilog_ams.so

test: test-corpus test-neovim

test-corpus:
	XDG_CACHE_HOME="$(CACHE_DIR)" $(TREE_SITTER) test --overview-only

test-neovim: build
	NVIM_LOG_FILE="$(CURDIR)/build/nvim.log" $(NVIM) --headless -u NONE -i NONE -l test/neovim.lua

test-rust:
	CARGO_HOME="$(CURDIR)/build/cargo" cargo test --locked

clean:
	rm -rf build parser target
