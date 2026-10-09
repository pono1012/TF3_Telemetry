-- Adds "Auto Line Namer" to the Line Manager's built-in Auto-Rename button.
-- This renames whatever lines you select, including ones protected by the tag prefix.

local core = nil

local function getCore()
	if core == nil then
		core = false
		if ug_require then
			for _, path in ipairs({
				"auto_line_namer_1::/auto_line_namer/aln_core.lua",
				"/auto_line_namer/aln_core.lua",
				"::/auto_line_namer/aln_core.lua",
			}) do
				local ok, result = pcall(ug_require, path)
				if ok and result then
					core = result
					break
				end
			end
		end
	end
	return core
end

function data()
	return {
		renameFn = function(renameParams)
			local aln = getCore()
			if not aln then
				return nil
			end
			local ok, name = pcall(aln.generateLineName, renameParams.lineEntity)
			if ok and name and name ~= "" then
				return name
			end
			return api.engine.util.getEntityName(renameParams.lineEntity)
		end,
	}
end
