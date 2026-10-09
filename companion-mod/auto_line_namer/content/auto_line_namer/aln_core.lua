-- Auto Line Namer (Cities First Edition): name generation, shared by the game script and the Auto-Rename scheme.
-- Original Transport Fever 3 port by Dave W (BeautifulCheez) (mod.io ID: 6414403).
-- Based on the Transport Fever 2 mod by erkanercan (MIT licence, see LICENSE).
-- Modification: Adjusted naming conventions so that townNames come first for alphabetical sorting.

local MOD_ID = "auto_line_namer_1"

local CONVENTIONS = {
	"{townNames} - {transportType} {cargoTypes}-{lineType}-{lineNumber}",
	"{townNames} - {transportType} - {cargoTypes} {lineType}",
	"{townNames}: {transportType} ({lineNumber}) {lineType}",
}
local AUTO_UPDATE_MINUTES = { 0, 1, 2, 5, 10 }

-- Three-letter codes for the "Code" cargo name override, keyed by the cargo's resource id
-- (e.g. iron_ore/iron_ore.cargo -> iron_ore), which unlike display names is not translated.
local CARGO_CODES = {
	passengers = "PAX", beverages = "BEV", books = "BKS", bricks = "BRK", cement = "CEM",
	chemicals = "CHM", clay = "CLY", clothes = "CLO", coal = "COA", crude_oil = "OIL",
	dyes = "DYE", fabric = "FAB", fertilizer = "FRT", fish = "FSH", fuel = "FUL",
	furniture = "FUR", glass = "GLS", grain = "GRN", iron_ore = "ORE", logs = "LOG",
	machines = "MCH", meat = "MEA", paper = "PPR", planks = "PLK", plastic = "PLS",
	rubber = "RUB", sand = "SND", sawdust = "SWD", sheet_metal = "SHM", steel = "STL",
	stone = "STN", tinned_food = "CAN", tires = "TYR", tools = "TLS", vegetables = "VEG",
	vehicles = "VEH", wool = "WOL",
}
-- Per-cargo override, from the "Cargo: ..." mod options.
local CARGO_MODE = { DEFAULT = 0, FULL = 1, SHORT = 2, CODE = 3 }
-- What {townNames} is filled with, from the Stop Names option.
local STOP_NAMES = { TOWNS = 0, STATIONS = 1, INDUSTRIES = 2 }

local DEFAULTS = {
	customConvention = CONVENTIONS[1],
	tagPrefix = "Cst",
	transportType = {
		roadPassenger = "Bus",
		roadCargo = "RC",
		tramPassenger = "Tram",
		tramCargo = "TrC",
		trainPassenger = "TP",
		trainCargo = "TC",
		waterPassenger = "WP",
		waterCargo = "WC",
		airPassenger = "AP",
		airCargo = "AC",
		heliPassenger = "HE",
		heliCargo = "HC",
		unknown = "UNK",
	},
	lineType = {
		localLineAddon = "LO",
		intercityLineAddon = "IC",
		regionalLineAddon = "RE",
	},
	cargoSeparator = ",",
	townSeparator = "-",
	maxCargoTypes = 3,
}

-- Transport Labels option "Long". Only replaces labels still at their default, so labels
-- changed in aln_config.lua are kept.
local LONG_TRANSPORT_TYPES = {
	roadPassenger = "Road - Bus",
	roadCargo = "Road - Truck",
	tramPassenger = "Road - Tram",
	tramCargo = "Road - Cargo Tram",
	trainPassenger = "Rail",
	trainCargo = "Rail",
	waterPassenger = "Water",
	waterCargo = "Water",
	airPassenger = "Air - Airplane",
	airCargo = "Air - Airplane",
	heliPassenger = "Air - Helicopter",
	heliCargo = "Air - Helicopter",
}

local core = {}

local function log(msg)
	print("[Auto Line Namer] " .. tostring(msg))
end
core.log = log

-- The game resolves mod files through a virtual file system; try the likely spellings of our path.
function core.require(file)
	if not ug_require then
		return nil
	end
	for _, path in ipairs({
		MOD_ID .. "::/auto_line_namer/" .. file,
		"/auto_line_namer/" .. file,
		"::/auto_line_namer/" .. file,
	}) do
		local ok, result = pcall(ug_require, path)
		if ok and result then
			return result
		end
	end
	log("could not load " .. file)
	return nil
end

local function merge(base, over)
	local out = {}
	for k, v in pairs(base) do
		if type(v) == "table" then
			out[k] = merge(v, type(over) == "table" and type(over[k]) == "table" and over[k] or {})
		elseif type(over) == "table" and over[k] ~= nil and type(over[k]) == type(v) then
			out[k] = over[k]
		else
			out[k] = v
		end
	end
	return out
end

local function getModParams()
	local ok, all = pcall(function() return api.engine.config.getModParams() end)
	if not ok or type(all) ~= "table" then
		return {}
	end
	if type(all[MOD_ID]) == "table" then
		return all[MOD_ID]
	end
	for _, params in pairs(all) do
		if type(params) == "table" and params["aln.convention"] ~= nil then
			return params
		end
	end
	return {}
end

-- The game stores the chosen option counted from 1; returns it counted from 0, or the mod.json default.
local PARAM_DEFAULTS = {
	["aln.convention"] = 0, ["aln.townNames"] = 0, ["aln.cargoNames"] = 0, ["aln.autoUpdate"] = 1,
	["aln.numberDigits"] = 0, ["aln.stopNames"] = 0,
	["aln.transportLabels"] = 0, ["aln.cargoStopNames"] = 0, ["aln.cargoPlaces"] = 0,
}
local function paramIndex(params, key)
	local value = math.floor(tonumber(params[key]) or 0)
	if value < 1 then
		return PARAM_DEFAULTS[key] or 0
	end
	return value - 1
end

local settingsCache = nil

-- Settings = defaults <- aln_config.lua <- choices from the mod options screen.
function core.getSettings()
	if settingsCache then
		return settingsCache
	end
	local settings = merge(DEFAULTS, core.require("aln_config.lua") or {})
	local params = getModParams()

	settings.convention = CONVENTIONS[paramIndex(params, "aln.convention") + 1] or settings.customConvention
	settings.townShort = paramIndex(params, "aln.townNames") == 0
	settings.stopNames = paramIndex(params, "aln.stopNames")
	-- Cargo Stop Names: 0 = same as Stop Names, otherwise Towns / Stations / Industries for cargo lines.
	local cargoStopNames = paramIndex(params, "aln.cargoStopNames")
	settings.cargoStopNames = cargoStopNames > 0 and cargoStopNames - 1 or nil
	-- Cargo Lines Show: 0 = first and last stop, 1 = delivery (last) stop only.
	settings.cargoLastStopOnly = paramIndex(params, "aln.cargoPlaces") == 1
	if paramIndex(params, "aln.transportLabels") == 1 then
		for key, long in pairs(LONG_TRANSPORT_TYPES) do
			if settings.transportType[key] == DEFAULTS.transportType[key] then
				settings.transportType[key] = long
			end
		end
	end
	-- Main Cargo Names setting: 0 = Full, 1 = Short, 2 = Code. Cargo left on Default follows it.
	settings.cargoNamesMode = ({ [0] = CARGO_MODE.FULL, [1] = CARGO_MODE.SHORT, [2] = CARGO_MODE.CODE })[paramIndex(params, "aln.cargoNames")]
		or CARGO_MODE.FULL
	settings.autoUpdateMinutes = AUTO_UPDATE_MINUTES[paramIndex(params, "aln.autoUpdate") + 1] or 1
	settings.numberDigits = math.min(paramIndex(params, "aln.numberDigits") + 1, 4)
	settings.cargoModes = {}
	for cargoKey in pairs(CARGO_CODES) do
		settings.cargoModes[cargoKey] = paramIndex(params, "aln.cargo." .. cargoKey)
	end

	settingsCache = settings
	return settings
end

-- Same rule as the original mod: rename unless the name starts with the protect prefix,
-- and always rename default names or the force-rename words r / reload.
function core.isUpdatableName(name, settings)
	if type(name) ~= "string" then
		return true
	end
	local lower = string.lower(name)
	local prefix = settings.tagPrefix or ""
	local escapedPrefix = prefix:gsub("(%W)", "%%%1")

	return name:match("^%s*$") ~= nil
		or lower == "r"
		or lower == "reload"
		or name:match("^Line %d+$") ~= nil
		or lower:match("^unk") ~= nil
		or not name:match("^" .. escapedPrefix)
end

function core.isForceRename(name)
	local lower = type(name) == "string" and string.lower(name) or ""
	return lower == "r" or lower == "reload"
end

-- First three characters of each word, counting UTF-8 characters rather than bytes.
local function abbreviate(text)
	local out = ""
	for word in text:gmatch("%S+") do
		local count = 0
		for char in word:gmatch("[%z\1-\127\194-\244][\128-\191]*") do
			out = out .. char
			count = count + 1
			if count == 3 then
				break
			end
		end
	end
	return out
end

local function entityName(entity)
	local ok, name = pcall(api.engine.util.getEntityName, entity)
	if ok and type(name) == "string" then
		return name
	end
	return nil
end

local function isPassengerCargo(cargoType)
	if cargoType.cargoClasses then
		for _, class in ipairs(cargoType.cargoClasses) do
			if class == "PASSENGERS" then
				return true
			end
		end
	end
	return cargoType.name == "Passengers"
end

-- Resource names look like "iron_ore/iron_ore.cargo" (possibly with a "::/" or mod prefix).
local function cargoKeyFromResName(resName)
	if type(resName) ~= "string" then
		return nil
	end
	return resName:match("([%w_]+)%.cargo$") or resName:match("([%w_]+)%.cargo%.lua$")
end

-- A plain record of what the naming needs: display name, untranslated key, cargo classes.
local function cargoTypeById(cargoTypeId)
	local ok, cargoType = pcall(api.res.cargoTypeRep.get, cargoTypeId)
	if not (ok and cargoType and cargoType.name) then
		return nil
	end
	local okName, resName = pcall(api.res.cargoTypeRep.getName, cargoTypeId)
	return {
		id = cargoTypeId,
		name = cargoType.name,
		key = okName and cargoKeyFromResName(resName) or nil,
		cargoClasses = cargoType.cargoClasses,
	}
end

-- The station entity a stop uses.
local function stopStation(stop)
	local group = api.engine.getComponent(stop.stationGroup, api.type.ComponentType.STATION_GROUP)
	local stations = group and group.stations
	return stations and (stations[(stop.station or 0) + 1] or stations[1])
end

-- Towns in the order the line first reaches them.
local function getTowns(line, station2town)
	local towns, seen = {}, {}
	for _, stop in ipairs(line.stops) do
		local station = stopStation(stop)
		local town = station and station2town[station]
		if town and not seen[town] and api.engine.entityExists(town) then
			seen[town] = true
			local name = entityName(town)
			if name then
				table.insert(towns, name)
			end
		end
	end
	return towns
end

-- Station names in the order the line first reaches them.
local function getStationNames(line)
	local names, seen = {}, {}
	for _, stop in ipairs(line.stops) do
		local name = entityName(stop.stationGroup)
		if name and not seen[name] then
			seen[name] = true
			table.insert(names, name)
		end
	end
	return names
end

-- Map of stock list entity -> industry or warehouse entity. Catchment lookups return stock lists,
-- which don't point back to their owner. Rebuilt at most every 30 seconds, since a full pass asks
-- for it once per line.
local ownersCache, ownersTime = nil, nil
local function getStockListOwners()
	local now = os.time()
	if ownersCache and now - ownersTime < 30 then
		return ownersCache
	end
	local owners = {}
	for _, componentType in ipairs({ api.type.ComponentType.INDUSTRY, api.type.ComponentType.WAREHOUSE }) do
		pcall(api.engine.forEachEntityWithComponent, function(entity)
			local component = api.engine.getComponent(entity, componentType)
			if component and component.stockList then
				owners[component.stockList] = entity
			end
		end, componentType)
	end
	ownersCache, ownersTime = owners, now
	return owners
end

-- Cargo ids a stock list holds or produces, as a set.
local function stockListCargo(stockListEntity)
	local cargo = {}
	local stockList = api.engine.getComponent(stockListEntity, api.type.ComponentType.STOCK_LIST)
	if not stockList then
		return cargo
	end
	pcall(function()
		for _, stock in ipairs(stockList.stocks or {}) do
			if stock.cargoType ~= nil then
				cargo[stock.cargoType] = true
			end
			for k, v in pairs(stock.cargoTypes or {}) do
				if v == true then
					cargo[k] = true
				elseif type(v) == "number" then
					cargo[v] = true
				end
			end
		end
		for _, rule in ipairs(stockList.rules or {}) do
			for cargoId in pairs(rule.output or {}) do
				cargo[cargoId] = true
			end
		end
	end)
	return cargo
end

-- Name of the industry (or warehouse) a station serves: one trading the line's cargo if there is
-- one, otherwise the first one in its catchment area.
local function stationIndustryName(station, cargoIds, owners)
	local ok, catchables = pcall(api.engine.system.catchmentAreaSystem.getStationCatchables, station, true)
	if not ok or not catchables then
		return nil
	end
	local fallback = nil
	for _, catchable in ipairs(catchables) do
		local owner = owners[catchable]
		if not owner and (api.engine.getComponent(catchable, api.type.ComponentType.INDUSTRY)
				or api.engine.getComponent(catchable, api.type.ComponentType.WAREHOUSE)) then
			owner = catchable
		end
		local name = owner and entityName(owner)
		if name then
			local cargo = stockListCargo(catchable)
			for _, id in ipairs(cargoIds) do
				if cargo[id] then
					return name
				end
			end
			fallback = fallback or name
		end
	end
	return fallback
end

-- Per stop, the industry it serves or else its station name, in the order the line reaches them.
local function getIndustryNames(line, cargoTypes)
	local owners = getStockListOwners()
	local cargoIds = {}
	for _, cargoType in ipairs(cargoTypes) do
		if not isPassengerCargo(cargoType) then
			table.insert(cargoIds, cargoType.id)
		end
	end
	local names, seen = {}, {}
	for _, stop in ipairs(line.stops) do
		local station = stopStation(stop)
		local name = station and stationIndustryName(station, cargoIds, owners) or entityName(stop.stationGroup)
		if name and not seen[name] then
			seen[name] = true
			table.insert(names, name)
		end
	end
	return names
end

local function addCargo(list, seen, cargoTypeId)
	local cargoType = cargoTypeById(cargoTypeId)
	if cargoType and not seen[cargoType.name] then
		seen[cargoType.name] = true
		table.insert(list, cargoType)
	end
end

-- What the line carries: its stop load settings, or failing that what its vehicles can hold.
local function getCargoTypes(line, vehicles)
	local list, seen = {}, {}
	for _, stop in ipairs(line.stops) do
		local load = stop.stopConfig and stop.stopConfig.load
		if load then
			for i, enabled in ipairs(load) do
				if enabled then
					addCargo(list, seen, i - 1)
				end
			end
		end
	end
	if #list == 0 then
		for _, vehicle in ipairs(vehicles) do
			local capacities = vehicle.config and vehicle.config.capacities
			if capacities then
				for i, capacity in ipairs(capacities) do
					if capacity and capacity > 0 then
						addCargo(list, seen, i - 1)
					end
				end
			end
		end
	end
	return list
end

-- The line's carrier comes from its vehicles, or from its stations while it has none.
local function getCarrier(line, vehicles)
	for _, vehicle in ipairs(vehicles) do
		if vehicle.carrier ~= nil then
			return vehicle.carrier
		end
	end
	for _, stop in ipairs(line.stops) do
		local ok, result = pcall(api.engine.system.stationGroupSystem.getCarriers, stop.stationGroup, -1, -1)
		if ok and result and result[1] and result[1][1] ~= nil then
			return result[1][1]
		end
	end
	return nil
end

-- Whether a transport mode list includes a mode. The API documents a map of mode -> true;
-- TF2 used an array of 1/0 indexed by mode + 1, so accept both.
local function hasTransportMode(modes, mode)
	if modes == nil or mode == nil then
		return false
	end
	local ok, found = pcall(function()
		return modes[mode] == true or modes[mode + 1] == 1
	end)
	return ok and found
end

-- Helicopters share the AIR carrier with planes; only their transport mode tells them apart.
local function isHelicopterLine(line, vehicles)
	local helicopter = api.type.enum.TransportMode.HELICOPTER
	for _, vehicle in ipairs(vehicles) do
		if vehicle.config and hasTransportMode(vehicle.config.transportModes, helicopter) then
			return true
		end
	end
	if #vehicles == 0 and line.vehicleInfo then
		return hasTransportMode(line.vehicleInfo.transportModes, helicopter)
	end
	return false
end

local function buildTransportType(carrier, carriesCargo, labels, helicopter)
	local Carrier = api.type.enum.Carrier
	if helicopter then
		return carriesCargo and labels.heliCargo or labels.heliPassenger
	elseif carrier == Carrier.ROAD then
		return carriesCargo and labels.roadCargo or labels.roadPassenger
	elseif carrier == Carrier.TRAM then
		return carriesCargo and labels.tramCargo or labels.tramPassenger
	elseif carrier == Carrier.RAIL then
		return carriesCargo and labels.trainCargo or labels.trainPassenger
	elseif carrier == Carrier.WATER then
		return carriesCargo and labels.waterCargo or labels.waterPassenger
	elseif carrier == Carrier.AIR then
		return carriesCargo and labels.airCargo or labels.airPassenger
	end
	return labels.unknown
end

-- One cargo's label: its per-cargo override if set, otherwise the main Cargo Names setting.
local function cargoLabel(cargoType, settings)
	local mode = cargoType.key and settings.cargoModes and settings.cargoModes[cargoType.key] or CARGO_MODE.DEFAULT
	if mode == CARGO_MODE.DEFAULT then
		mode = settings.cargoNamesMode or CARGO_MODE.FULL
	end
	if mode == CARGO_MODE.CODE then
		-- Cargo added by other mods has no code; fall back to the short form.
		return cargoType.key and CARGO_CODES[cargoType.key] or abbreviate(cargoType.name)
	elseif mode == CARGO_MODE.SHORT then
		return abbreviate(cargoType.name)
	end
	return cargoType.name
end

local function buildCargoTypes(cargoTypes, settings)
	local names = {}
	local limit = settings.maxCargoTypes
	for i, cargoType in ipairs(cargoTypes) do
		if limit > 0 and i > limit then
			break
		end
		table.insert(names, cargoLabel(cargoType, settings))
	end
	local text = table.concat(names, settings.cargoSeparator)
	if limit > 0 and #cargoTypes > limit then
		text = text .. settings.cargoSeparator .. "+" .. (#cargoTypes - limit)
	end
	return text
end

local function buildTownNames(towns, settings, lastOnly)
	local first, last = towns[1], towns[#towns]
	local function format(town)
		return settings.townShort and abbreviate(town) or town
	end
	if lastOnly then
		return format(last)
	end
	local text = format(first)
	if #towns > 1 and first ~= last then
		text = text .. settings.townSeparator .. format(last)
	end
	return text
end

local function buildLineType(towns, labels)
	if #towns == 1 then
		return labels.localLineAddon
	elseif #towns == 2 then
		return labels.intercityLineAddon
	end
	return labels.regionalLineAddon
end

-- Map of line name -> line id for all the player's lines, used to number duplicate names.
function core.getLineNames()
	local names = {}
	for _, lineId in ipairs(api.engine.system.lineSystem.getLinesForPlayer(api.engine.util.getPlayer())) do
		local name = entityName(lineId)
		if name then
			names[name] = lineId
		end
	end
	return names
end

-- 7 -> "7", "07", "007" or "0007" depending on the Line Number Digits option.
local function formatNumber(n, digits)
	return string.format("%0" .. tostring(digits or 1) .. "d", n)
end

-- Fills in {lineNumber} with the lowest number whose name no other line uses.
-- A line that already has one of its valid names keeps it, so numbers don't shuffle around.
local function numberName(lineId, template, lineNames, digits)
	if not template:find("\1", 1, true) then
		return template
	end
	-- A line that already has one of this template's names keeps it. Checked directly against the
	-- current name rather than by trying every number, which made a full pass grow with lines squared.
	local current = entityName(lineId)
	if current then
		local pattern = "^" .. template:gsub("[%^%$%(%)%%%.%[%]%*%+%-%?]", "%%%0"):gsub("\1", "(%%d+)") .. "$"
		local digitsText = current:match(pattern)
		local owner = lineNames[current]
		if digitsText and digitsText == formatNumber(tonumber(digitsText), digits) and (owner == nil or owner == lineId) then
			return current
		end
	end
	-- Otherwise the lowest number no other line uses (only as many steps as lines sharing the name).
	local n = 1
	while true do
		local candidate = template:gsub("\1", formatNumber(n, digits))
		local owner = lineNames[candidate]
		if owner == nil or owner == lineId then
			return candidate
		end
		n = n + 1
	end
end

-- Builds the name for a line, or nil if it has no stops in a town yet.
-- station2town and lineNames may be passed in to share one lookup across many lines.
function core.generateLineName(lineId, settings, station2town, lineNames)
	settings = settings or core.getSettings()
	if not api.engine.entityExists(lineId) then
		return nil
	end
	local line = api.engine.getComponent(lineId, api.type.ComponentType.LINE)
	if not line or not line.stops then
		return nil
	end

	station2town = station2town or api.engine.system.stationSystem.getStation2TownMap()
	local towns = getTowns(line, station2town)
	-- Stops outside any town still have a station or industry name. Cargo lines may use their
	-- own Stop Names choice, which is only known once the line's cargo is read below.
	local function usesTowns(stopNames)
		return stopNames ~= STOP_NAMES.STATIONS and stopNames ~= STOP_NAMES.INDUSTRIES
	end
	if #towns == 0 and usesTowns(settings.stopNames)
			and (settings.cargoStopNames == nil or usesTowns(settings.cargoStopNames)) then
		return nil
	end

	local vehicles = {}
	for _, vehicleId in ipairs(api.engine.system.transportVehicleSystem.getLineVehicles(lineId)) do
		local vehicle = api.engine.getComponent(vehicleId, api.type.ComponentType.TRANSPORT_VEHICLE)
		if vehicle then
			table.insert(vehicles, vehicle)
		end
	end

	local cargoTypes = getCargoTypes(line, vehicles)
	local carriesCargo = false
	for _, cargoType in ipairs(cargoTypes) do
		if not isPassengerCargo(cargoType) then
			carriesCargo = true
			break
		end
	end

	local stopNames = carriesCargo and settings.cargoStopNames or settings.stopNames
	if #towns == 0 and usesTowns(stopNames) then
		return nil
	end
	local places = towns
	if stopNames == STOP_NAMES.STATIONS then
		places = getStationNames(line)
	elseif stopNames == STOP_NAMES.INDUSTRIES then
		places = getIndustryNames(line, cargoTypes)
	end
	if #places == 0 then
		return nil
	end

	local values = {
		transportType = buildTransportType(getCarrier(line, vehicles), carriesCargo, settings.transportType,
			isHelicopterLine(line, vehicles)),
		cargoTypes = buildCargoTypes(cargoTypes, settings),
		townNames = buildTownNames(places, settings, carriesCargo and settings.cargoLastStopOnly),
		lineType = buildLineType(towns, settings.lineType),
		lineNumber = "\1",
	}
	-- A function replacement keeps "%" in town or cargo names from breaking gsub.
	local template = settings.convention:gsub("{(%w+)}", function(token)
		return values[token]
	end)
	return numberName(lineId, template, lineNames or core.getLineNames(), settings.numberDigits)
end

-- Sample name for the settings preview, using the original mod's example line.
function core.previewName(settings)
	settings = settings or core.getSettings()
	local town = function(name) return settings.townShort and abbreviate(name) or name end
	local first, last = "Springfield", "Shelbyville"
	if settings.stopNames == STOP_NAMES.STATIONS then
		first, last = "Springfield Port", "Shelbyville Port"
	elseif settings.stopNames == STOP_NAMES.INDUSTRIES then
		first, last = "Oil Well", "Oil Refinery"
	end
	local values = {
		transportType = settings.transportType.roadPassenger,
		cargoTypes = cargoLabel({ name = "Passengers", key = "passengers" }, settings),
		townNames = town(first) .. settings.townSeparator .. town(last),
		lineType = settings.lineType.intercityLineAddon,
		lineNumber = formatNumber(1, settings.numberDigits),
	}
	local name = settings.convention:gsub("{(%w+)}", function(token)
		return values[token]
	end)
	return name
end

return core
