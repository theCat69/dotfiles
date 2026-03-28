rm ~/.config/opencode/agents/Orchestrator.md
# rm ~/.config/opencode/agents/builder.md
rm ~/.config/opencode/agents/coder.md
rm ~/.config/opencode/agents/external-context-gatherer.md
rm ~/.config/opencode/agents/librarian.md
rm ~/.config/opencode/agents/local-context-gatherer.md
rm ~/.config/opencode/agents/reviewer.md
rm ~/.config/opencode/agents/security-reviewer.md
# rm ~/.config/opencode/agents/tester.md
ln -s $(pwd)/Orchestrator.md ~/.config/opencode/agents/Orchestrator.md
ln -s $(pwd)/subagents/* ~/.config/opencode/agents/

