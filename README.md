# DriveLLM

DriveLLM is a browser-based local LLM platform built around Google Drive, Google Apps Script, and Google Chrome.

Google Drive stores configuration and knowledge. Apps Script provides the application layer. LLM inference is intended to run locally in Chrome using WebGPU.

The first implementation is the Phase 0 browser diagnostics app in [`gas/`](./gas/). Its Apps Script manifest restricts access to the deploying account (`MYSELF`). Phase 0 does not access Drive or run an LLM.

See [Development](./docs/DEVELOPMENT.md) to deploy the diagnostics app and [DriveLLM_Codex_Handoff.md](./DriveLLM_Codex_Handoff.md) for the full requirements and phased plan.
