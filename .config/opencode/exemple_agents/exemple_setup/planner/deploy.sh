rm ~/.config/opencode/agents/Planner.md
rm ~/.config/opencode/agents/feature-designer.md
rm ~/.config/opencode/agents/feature-reviewer.md
rm ~/.config/opencode/agents/feature-writer.md
rm ~/.config/opencode/agents/context-gatherer.md
ln -s $(pwd)/Planner.md ~/.config/opencode/agents/Planner.md
ln -s $(pwd)/subagents/* ~/.config/opencode/agents/
