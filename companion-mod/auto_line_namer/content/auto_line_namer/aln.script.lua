-- Auto Line Namer game script.
-- Renames new lines and lines named r / reload within a couple of seconds, and re-evaluates
-- every line on the Auto Update interval so cargo is picked up once vehicles are assigned.
-- The re-check is spread over the interval in small batches.
--
-- TF3 recreates this script's Lua state often, so anything that must last (known lines, timers)
-- lives in the saved script state rather than in local variables.

local QUICK_SCAN_SECONDS = 2

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
		if not core then
			print("[Auto Line Namer] could not load aln_core.lua, mod inactive")
		end
	end
	return core
end

-- lineNames is updated as we go, since the rename commands only take effect later.
local function renameLine(lineId, settings, station2town, lineNames)
	local current = api.engine.util.getEntityName(lineId)
	if not core.isUpdatableName(current, settings) then
		return
	end
	local newName = core.generateLineName(lineId, settings, station2town, lineNames)
	if newName and newName ~= "" and newName ~= current then
		api.cmd.sendCommand(api.cmd.makeEntitySetNameCmd(lineId, newName))
		if current and lineNames[current] == lineId then
			lineNames[current] = nil
		end
		lineNames[newName] = lineId
	end
end

local function playerLines()
	return api.engine.system.lineSystem.getLinesForPlayer(api.engine.util.getPlayer())
end

-- Renames lines that are new since the last scan, or named r / reload.
-- On a save that has never run the mod, the first scan only records the existing lines.
-- Returns true if the known lines changed.
local function quickScan(settings, saved)
	local known = {}
	for _, lineId in ipairs(saved.knownLines or {}) do
		known[lineId] = true
	end

	local lines = {}
	for _, lineId in ipairs(playerLines()) do
		table.insert(lines, lineId)
	end
	local station2town, lineNames = nil, nil
	local changed = not saved.knownLines or #saved.knownLines ~= #lines
	for _, lineId in ipairs(lines) do
		local isNew = saved.knownLines and not known[lineId]
		if isNew then
			changed = true
		end
		if isNew or core.isForceRename(api.engine.util.getEntityName(lineId)) then
			station2town = station2town or api.engine.system.stationSystem.getStation2TownMap()
			lineNames = lineNames or core.getLineNames()
			renameLine(lineId, settings, station2town, lineNames)
		end
	end

	if changed then
		saved.knownLines = lines
	end
	return changed
end

-- Auto Update re-check, spread over the interval: each scan re-checks a small batch of lines, sized so
-- every line is visited once per interval. The work per tick stays small however many lines exist,
-- instead of re-checking every line in one tick once a minute (a visible stutter on big saves).
local function recheckBatch(settings, saved)
	local lines = playerLines()
	local count = #lines
	if count == 0 then
		return
	end
	local scansPerInterval = math.max(1, math.floor(settings.autoUpdateMinutes * 60 / QUICK_SCAN_SECONDS))
	local batch = math.max(10, math.ceil(count / scansPerInterval))
	local cursor = saved.recheckCursor or 1
	if cursor > count then
		cursor = 1
	end
	local station2town = api.engine.system.stationSystem.getStation2TownMap()
	local lineNames = core.getLineNames()
	for i = cursor, math.min(count, cursor + batch - 1) do
		renameLine(lines[i], settings, station2town, lineNames)
	end
	saved.recheckCursor = cursor + batch
end

-- An error that keeps happening would otherwise be logged every 2 seconds: each distinct error is
-- logged once per save, at most 10 in total (kept in the saved state, which outlives the Lua state).
local function logErrorOnce(saved, msg)
	saved.loggedErrors = saved.loggedErrors or {}
	local count = 0
	for _ in pairs(saved.loggedErrors) do
		count = count + 1
	end
	if saved.loggedErrors[msg] or count >= 10 then
		return
	end
	saved.loggedErrors[msg] = true
	core.log(msg .. " (repeats of this error are not logged)")
end

function data()
	return {
		update = function(_userParams, state, _dt)
			if not getCore() then
				return
			end
			local saved = state:get() or {}
			local now = os.time()
			if saved.lastQuickScan and now - saved.lastQuickScan < QUICK_SCAN_SECONDS then
				return
			end
			saved.lastQuickScan = now

			local settings = core.getSettings()
			if not saved.announced then
				saved.announced = true
				core.log("active. Convention " .. settings.convention .. " gives e.g. " .. core.previewName(settings))
			end

			local ok, err = pcall(quickScan, settings, saved)
			if not ok then
				logErrorOnce(saved, "scan failed: " .. tostring(err))
			end

			if settings.autoUpdateMinutes > 0 then
				ok, err = pcall(recheckBatch, settings, saved)
				if not ok then
					logErrorOnce(saved, "auto update failed: " .. tostring(err))
				end
			end

			state:set(saved)
		end,
	}
end
