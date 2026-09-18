# DSH Spire Jev adapter

This repository only adapts the public spire-jev controller API to DSH native tools. Keep all gameplay, locking, uncertain-action handling, provider requests, and round-plan verification in the core repository. Do not fork or vendor game logic here. Pin the core dependency to a verified commit. Never include credentials or player saves. Tests must not touch a real game unless explicitly running the bounded integration check.
