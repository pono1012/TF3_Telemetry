import os
import sys
import json
import shutil

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
COMPANION_MOD_DIR = os.path.join(SCRIPT_DIR, "companion-mod", "tf3_telemetry")

def find_game_mod_dir():
    if len(sys.argv) > 1 and os.path.isdir(sys.argv[1]):
        return sys.argv[1]
    if os.environ.get("TF3_MOD_DIR") and os.path.isdir(os.environ.get("TF3_MOD_DIR")):
        return os.environ.get("TF3_MOD_DIR")

    candidates = [
        r"E:\Spiele\Transport.Fever.3\Transport Fever 3\mods\release\tf3_telemetry",
        r"C:\Program Files (x86)\Steam\steamapps\common\Transport Fever 3\mods\tf3_telemetry",
        r"D:\SteamLibrary\steamapps\common\Transport Fever 3\mods\tf3_telemetry",
        r"E:\SteamLibrary\steamapps\common\Transport Fever 3\mods\tf3_telemetry",
    ]
    for c in candidates:
        if os.path.exists(c):
            return c
        parent = os.path.dirname(c)
        if os.path.exists(parent):
            return c
    return None

target_mod_dir = find_game_mod_dir()


telemetry_script_code = """
local __last_time = 999.0
print("[TF3_TELEMETRY] Telemetry script loaded and active!")
local __current_interval = 5.0
local __min_interval = 5.0
local __max_interval = 30.0
local __unchanged_count = 0
local __last_balance = 0
local __last_veh_count = 0
local __last_lines_count = 0
local __was_paused = false
local __last_export_wall_clock = 0

local __json_path = "live_telemetry.json"
local __last_line_t = {}
local __veh_static_cache = {}
local __line_meta_cache = {}
local __line_rate_cache = {}
local __fin_table_cache = nil
local __fin_table_t = 0
local __company_stats_cache = nil
local __company_stats_t = 0

local function escape_str(s)
    if not s then return '""' end
    s = tostring(s)
    s = s:gsub('\\\\', '\\\\\\\\'):gsub('"', '\\\\"'):gsub('\\n', '\\\\n'):gsub('\\r', '\\\\r'):gsub('\\t', '\\\\t')
    return '"' .. s .. '"'
end

local function serialize_json(val)
    local t = type(val)
    if t == "nil" then return "null"
    elseif t == "number" or t == "boolean" then return tostring(val)
    elseif t == "string" then return escape_str(val)
    elseif t == "table" then
        local is_arr = true
        local max_i = 0
        for k, _ in pairs(val) do
            if type(k) == "number" and math.floor(k) == k and k >= 1 then
                if k > max_i then max_i = k end
            else
                is_arr = false
                break
            end
        end
        if is_arr and max_i > 0 then
            local p = {}
            for i = 1, max_i do p[i] = serialize_json(val[i]) end
            return "[" .. table.concat(p, ",") .. "]"
        elseif is_arr and max_i == 0 then
            return "[]"
        else
            local p = {}
            for k, v in pairs(val) do
                table.insert(p, escape_str(k) .. ":" .. serialize_json(v))
            end
            return "{" .. table.concat(p, ",") .. "}"
        end
    end
    return "null"
end

-- ============================================================
-- AUTO LINE NAMER EXTRACTION & CACHING LOGIC
-- ============================================================
local function entityName(entity)
    if not entity then return nil end
    local ok, name = pcall(api.engine.util.getEntityName, entity)
    if ok and type(name) == "string" and #name > 0 then
        return name
    end
    local nc = api.engine.getComponent(entity, api.type.ComponentType.NAME)
    if nc and nc.name and #nc.name > 0 then
        return nc.name
    end
    return nil
end

local function isPassengerCargo(cargoType)
    if not cargoType then return false end
    if cargoType.cargoClasses then
        for _, class in ipairs(cargoType.cargoClasses) do
            if class == "PASSENGERS" then
                return true
            end
        end
    end
    return cargoType.name == "Passengers" or cargoType.name == "Passagiere"
end

local function cargoTypeById(cargoTypeId)
    local ok, cargoType = pcall(api.res.cargoTypeRep.get, cargoTypeId)
    if not (ok and cargoType and cargoType.name) then
        return nil
    end
    return {
        id = cargoTypeId,
        name = cargoType.name,
        cargoClasses = cargoType.cargoClasses,
    }
end

local function addCargo(list, seen, cargoTypeId)
    local cargoType = cargoTypeById(cargoTypeId)
    if cargoType and not seen[cargoType.name] then
        seen[cargoType.name] = true
        table.insert(list, cargoType)
    end
end

local function getCargoTypes(line, vehicles)
    local list, seen = {}, {}
    if line and line.stops then
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
    end
    if #list == 0 and vehicles then
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

local function stopStation(stop)
    if not stop or not stop.stationGroup then return nil end
    local group = api.engine.getComponent(stop.stationGroup, api.type.ComponentType.STATION_GROUP)
    local stations = group and group.stations
    return stations and (stations[(stop.station or 0) + 1] or stations[1])
end

local function getTowns(line, station2town)
    local towns, seen = {}, {}
    if not line or not line.stops or not station2town then return towns end
    for _, stop in ipairs(line.stops) do
        local station = stopStation(stop)
        local town = station and station2town[station]
        if town and not seen[town] then
            seen[town] = true
            local name = entityName(town)
            if name then
                table.insert(towns, name)
            end
        end
    end
    return towns
end

local function getCarrier(line, vehicles)
    for _, vehicle in ipairs(vehicles) do
        if vehicle.carrier ~= nil then
            return vehicle.carrier
        end
    end
    if line and line.stops then
        for _, stop in ipairs(line.stops) do
            local ok, result = pcall(api.engine.system.stationGroupSystem.getCarriers, stop.stationGroup, -1, -1)
            if ok and result and result[1] and result[1][1] ~= nil then
                return result[1][1]
            end
        end
    end
    return nil
end

local function export_telemetry_tick(dt)
    local now_c = os.clock()
    if (now_c - __last_export_wall_clock) < 3.5 then return end
    __last_export_wall_clock = now_c

    __last_time = __last_time + (dt or 0.1)
    if __last_time < __current_interval then return end
    __last_time = 0.0

    local ok, err = pcall(function()
        if not api or not api.engine or not api.engine.system then return end

        local tvSys = api.engine.system.transportVehicleSystem
        local simSys = api.engine.system.simEntityAtVehicleSystem
        local lineSys = api.engine.system.lineSystem
        if not tvSys then return end

        local now_t = os.time()

        local playerEntity = 0
        pcall(function()
            if api.engine.util and api.engine.util.getPlayer then
                playerEntity = api.engine.util.getPlayer()
            end
        end)

        -- 1. FAST SINGLE-PASS LINE DISCOVERY
        local allLineIds = {}
        local allLineMap = {}
        local function addLine(lid)
            if lid and type(lid) == "number" and not allLineMap[lid] then
                allLineMap[lid] = true
                table.insert(allLineIds, lid)
            end
        end

        pcall(function()
            if lineSys and lineSys.getLines then
                local res = lineSys.getLines()
                if res then
                    for _, lid in ipairs(res) do addLine(lid) end
                end
            end
        end)

        if #allLineIds == 0 and lineSys and lineSys.getLinesForPlayer then
            pcall(function()
                local res = lineSys.getLinesForPlayer(playerEntity)
                if res then
                    for _, lid in ipairs(res) do addLine(lid) end
                end
            end)
        end

        if #allLineIds == 0 then
            pcall(function()
                if api.engine and api.engine.getEntitiesWithComponent and api.type and api.type.ComponentType and api.type.ComponentType.LINE then
                    local res = api.engine.getEntitiesWithComponent(api.type.ComponentType.LINE)
                    if res then
                        for _, lid in ipairs(res) do addLine(lid) end
                    end
                end
            end)
        end

        print("[TF3_TELEMETRY] Line discovery completed. Found lines: " .. tostring(#allLineIds))
        if #allLineIds == 0 then return end

        -- 2. STATION TO TOWN MAP (Cached every 60s)
        local station2town = nil
        pcall(function()
            if api.engine.system.stationSystem and api.engine.system.stationSystem.getStation2TownMap then
                station2town = api.engine.system.stationSystem.getStation2TownMap()
            end
        end)

        -- 3. GLOBAL CARGO MAP
        local v2cMap = nil
        pcall(function()
            if simSys and simSys.getVehicle2Cargo2SimEntitesMap then
                v2cMap = simSys.getVehicle2Cargo2SimEntitesMap()
            end
        end)

        local linesList = {}
        local totalVehicles = 0

        local lastIncomeTime = 0
        pcall(function()
            if api.engine.util and api.engine.util.finance and api.engine.util.finance.getLastIncomeTime then
                lastIncomeTime = api.engine.util.finance.getLastIncomeTime(playerEntity)
            end
        end)

        -- 4. SIMULATION TIME & PAUSE STATE
        local isPaused = false
        local simSpeed = 1.0
        local worldGameTime = 0
        local gameDateStr = ""
        local playDurationStr = ""

        pcall(function()
            local worldEntity = (api.engine.util and api.engine.util.getWorld) and api.engine.util.getWorld() or 0
            if worldEntity and worldEntity > 0 then
                if api.type and api.type.ComponentType and api.type.ComponentType.GAME_SPEED then
                    local gs = api.engine.getComponent(worldEntity, api.type.ComponentType.GAME_SPEED)
                    if gs and gs.speedup ~= nil then
                        simSpeed = gs.speedup
                        isPaused = (gs.speedup == 0)
                    end
                end
                if api.type and api.type.ComponentType and api.type.ComponentType.GAME_TIME then
                    local gt = api.engine.getComponent(worldEntity, api.type.ComponentType.GAME_TIME)
                    if gt and gt.gameTime then
                        worldGameTime = gt.gameTime
                        if api.engine.util and api.engine.util.getCalendarDate and worldGameTime > 0 then
                            local dObj = api.engine.util.getCalendarDate(worldGameTime)
                            if dObj and dObj.day and dObj.month and dObj.year then
                                gameDateStr = string.format("%02d.%02d.%04d", dObj.day, dObj.month, dObj.year)
                            end
                        end
                        if api.util and api.util.formatGameTime and worldGameTime > 0 then
                            playDurationStr = api.util.formatGameTime(worldGameTime)
                        end
                    end
                end
            end
        end)

        if gameDateStr == "" and lastIncomeTime > 0 and api.util and api.util.formatGameTime then
            pcall(function()
                playDurationStr = api.util.formatGameTime(lastIncomeTime)
            end)
        end

        -- If game was paused and is still paused, back off to 20s interval to save 100% CPU
        if isPaused and __was_paused then
            __current_interval = 20.0
        end
        __was_paused = isPaused

        -- 5. COMPANY FINANCES (Core balance fast; detailed 4y table cached for 45s)
        local companyFinances = {
            bankBalance = 0,
            loan = 0,
            earningsYear = 0,
            hasData = false,
            tableYears = {},
            totalsByYear = {},
            balanceByYear = {},
            loanByYear = {},
            interestByYear = {},
            transport = {},
            investment = {},
            other = {}
        }

        pcall(function()
            if api.engine.util and api.engine.util.finance then
                local finUtil = api.engine.util.finance
                if finUtil.getPlayersBalance then
                    local bal = finUtil.getPlayersBalance(playerEntity)
                    if bal ~= nil then
                        companyFinances.bankBalance = bal
                        companyFinances.hasData = true
                    end
                end
                if finUtil.calculateEarnings then
                    companyFinances.earningsYear = finUtil.calculateEarnings(playerEntity) or 0
                end
            end
        end)

        pcall(function()
            if api.type and api.type.ComponentType and api.type.ComponentType.ACCOUNT then
                local acc = api.engine.getComponent(playerEntity, api.type.ComponentType.ACCOUNT)
                if acc then
                    if acc.balance ~= nil and not companyFinances.hasData then
                        companyFinances.bankBalance = acc.balance
                        companyFinances.hasData = true
                    end
                    if acc.loan ~= nil then
                        companyFinances.loan = acc.loan
                    end
                end
            end
        end)

        -- Cached detailed financial journals (Runs only once every 45s)
        if __fin_table_cache and (now_t - __fin_table_t < 45) then
            companyFinances.tableYears = __fin_table_cache.tableYears
            companyFinances.totalsByYear = __fin_table_cache.totalsByYear
            companyFinances.balanceByYear = __fin_table_cache.balanceByYear
            companyFinances.loanByYear = __fin_table_cache.loanByYear
            companyFinances.interestByYear = __fin_table_cache.interestByYear
            companyFinances.transport = __fin_table_cache.transport
            companyFinances.investment = __fin_table_cache.investment
            companyFinances.other = __fin_table_cache.other
        else
            pcall(function()
                if api.engine.util and api.engine.util.finance and api.engine.util.finance.computeFinanceTable then
                    local cfg = { count = 4, interval = 1, minCount = 1, yStepScale = 1.0 }
                    local fd = api.engine.util.finance.computeFinanceTable(playerEntity, cfg)
                    if fd then
                        local function vecToArr(vec)
                            local res = {}
                            if not vec then return res end
                            pcall(function()
                                for _, v in ipairs(vec) do table.insert(res, v) end
                            end)
                            return res
                        end

                        local ft = {
                            tableYears = vecToArr(fd.header),
                            totalsByYear = vecToArr(fd.total),
                            balanceByYear = vecToArr(fd.balance),
                            loanByYear = vecToArr(fd.loan),
                            interestByYear = vecToArr(fd.interest),
                            transport = {},
                            investment = {},
                            other = {}
                        }

                        if fd.foreach_carrier and fd.foreach_transport then
                            fd:foreach_carrier(function(carrier)
                                local cKey = "ROAD"
                                if api.type and api.type.JournalEntry and api.type.JournalEntry.Carrier then
                                    local C = api.type.JournalEntry.Carrier
                                    if carrier == C.ROAD then cKey = "ROAD"
                                    elseif carrier == C.RAIL then cKey = "RAIL"
                                    elseif carrier == C.TRAM then cKey = "TRAM"
                                    elseif carrier == C.WATER then cKey = "WATER"
                                    elseif carrier == C.AIR then cKey = "AIR"
                                    else cKey = "OTHER" end
                                end

                                local carrierRows = {}
                                fd:foreach_transport(function(key, values)
                                    local rowName = "Other"
                                    pcall(function()
                                        local unfolded = fd:unfoldKey(key)
                                        if unfolded then
                                            local JT = api.type.JournalEntry.Type
                                            local JM = api.type.JournalEntry.Maintenance
                                            local JC = api.type.JournalEntry.Construction
                                            if unfolded[1] == JT.INCOME then
                                                rowName = "Revenue"
                                            elseif unfolded[1] == JT.MAINTENANCE then
                                                if unfolded[2] == JM.VEHICLE then rowName = "Running Costs Vehicles"
                                                elseif unfolded[2] == JM.VEHICLE_MAINTENANCE then rowName = "Maintenance Vehicles"
                                                elseif unfolded[2] == JM.INFRASTRUCTURE then
                                                    if unfolded[3] == JC.STREET then rowName = "Upkeep Roads"
                                                    elseif unfolded[3] == JC.TRACK then rowName = "Upkeep Tracks"
                                                    elseif unfolded[3] == JC.WAREHOUSE then rowName = "Upkeep Warehouses"
                                                    else rowName = "Upkeep Buildings" end
                                                end
                                            end
                                        end
                                    end)
                                    carrierRows[rowName] = vecToArr(values)
                                end, carrier)
                                ft.transport[cKey] = carrierRows
                            end)
                        end

                        if fd.foreach_investment then
                            fd:foreach_investment(function(key, values)
                                local rowName = "Investment"
                                pcall(function()
                                    local unfolded = fd:unfoldKey(key)
                                    if unfolded then
                                        local JT = api.type.JournalEntry.Type
                                        local JC = api.type.JournalEntry.Construction
                                        if unfolded[1] == JT.ACQUISITION then rowName = "Vehicles"
                                        elseif unfolded[1] == JT.CONSTRUCTION then
                                            if unfolded[3] == JC.STREET then rowName = "Roads"
                                            elseif unfolded[3] == JC.TRACK then rowName = "Tracks"
                                            elseif unfolded[3] == JC.WAREHOUSE then rowName = "Warehouses"
                                            else rowName = "Infrastructure" end
                                        end
                                    end
                                end)
                                ft.investment[rowName] = vecToArr(values)
                            end)
                        end

                        if fd.foreach_other then
                            fd:foreach_other(function(key, values)
                                local rowName = "Other"
                                pcall(function()
                                    local unfolded = fd:unfoldKey(key)
                                    if unfolded and unfolded[3] == api.type.JournalEntry.Construction.WAREHOUSE then
                                        rowName = "Upkeep Warehouses"
                                    end
                                end)
                                ft.other[rowName] = vecToArr(values)
                            end)
                        end

                        __fin_table_cache = ft
                        __fin_table_t = now_t

                        companyFinances.tableYears = ft.tableYears
                        companyFinances.totalsByYear = ft.totalsByYear
                        companyFinances.balanceByYear = ft.balanceByYear
                        companyFinances.loanByYear = ft.loanByYear
                        companyFinances.interestByYear = ft.interestByYear
                        companyFinances.transport = ft.transport
                        companyFinances.investment = ft.investment
                        companyFinances.other = ft.other
                    end
                end
            end)
        end

        -- 6. COMPANY STATS (Cached for 30s)
        local companyStats = __company_stats_cache
        if not companyStats or (now_t - __company_stats_t > 30) then
            pcall(function()
                if api.engine.util and api.engine.util.headquarters and api.engine.util.headquarters.getCompaniesValue then
                    local cv = api.engine.util.headquarters.getCompaniesValue()
                    if cv then
                        companyStats = {
                            totalScore = cv.totalScore,
                            roadVehicles = cv.roadVehicles,
                            railVehicles = cv.railVehicles,
                            trams = cv.trams,
                            aircrafts = cv.aircrafts,
                            ships = cv.ships,
                            roadTotalLength = cv.roadTotalLength,
                            trackTotalLength = cv.trackTotalLength,
                            bridgeTotalLength = cv.bridgeTotalLength,
                            tunnelTotalLength = cv.tunnelTotalLength,
                            suppliedTowns = cv.suppliedTowns,
                            connectedIndustries = cv.connectedIndustries,
                            numberOfLines = cv.numberOfLines,
                            totalStations = cv.totalStations
                        }
                        __company_stats_cache = companyStats
                        __company_stats_t = now_t
                    end
                end
            end)
        end

        local Carrier = api.type.enum.Carrier
        local terminalSys = api.engine.system.simEntityAtTerminalSystem
        local stationMap = {}
        local paxSummary = { load = 0, capacity = 0, waiting = 0, lineCount = 0, vehicleCount = 0, util = 0 }
        local cargoSummary = { load = 0, capacity = 0, waiting = 0, lineCount = 0, vehicleCount = 0, util = 0 }

        for _, lid in ipairs(allLineIds) do
            pcall(function()
                local lineComp = nil
                pcall(function()
                    if api.type and api.type.ComponentType and api.type.ComponentType.LINE then
                        lineComp = api.engine.getComponent(lid, api.type.ComponentType.LINE)
                    end
                end)

                -- Vehicles
                local vList = {}
                local vehicles = {}
                pcall(function()
                    if tvSys.getLineVehicles then
                        vList = tvSys.getLineVehicles(lid) or {}
                        for _, vid in ipairs(vList) do
                            local vComp = api.engine.getComponent(vid, api.type.ComponentType.TRANSPORT_VEHICLE)
                            if vComp then table.insert(vehicles, vComp) end
                        end
                    end
                end)
                local v_count = #vList

                -- Cached Metadata (Name, Towns, Carrier, Cargo)
                local meta = __line_meta_cache[lid]
                local stopCount = (lineComp and lineComp.stops) and #lineComp.stops or 0
                if not meta or (now_t - meta.t > 45) or meta.stopCount ~= stopCount or meta.vCount ~= v_count then
                    local lName = entityName(lid) or ("Linie " .. tostring(lid))
                    local towns = getTowns(lineComp, station2town)
                    local cargoTypes = getCargoTypes(lineComp, vehicles)
                    local carriesCargo = false
                    local cargoIds = {}
                    for _, ct in ipairs(cargoTypes) do
                        if ct.id ~= nil then table.insert(cargoIds, ct.id) end
                        if not isPassengerCargo(ct) then carriesCargo = true end
                    end

                    local rawCarrier = getCarrier(lineComp, vehicles)
                    local carrier = "ROAD_CARGO"
                    local isOpnv = false
                    if rawCarrier == Carrier.ROAD or rawCarrier == Carrier.TRAM then
                        if carriesCargo then carrier = "ROAD_CARGO"; isOpnv = false
                        else carrier = "ROAD_PERSON"; isOpnv = true end
                    elseif rawCarrier == Carrier.RAIL then
                        carrier = "RAIL"; isOpnv = not carriesCargo
                    elseif rawCarrier == Carrier.WATER then
                        carrier = "WATER"; isOpnv = not carriesCargo
                    elseif rawCarrier == Carrier.AIR then
                        carrier = "AIR"; isOpnv = not carriesCargo
                    else
                        if carriesCargo then carrier = "ROAD_CARGO"; isOpnv = false
                        else carrier = "ROAD_PERSON"; isOpnv = true end
                    end

                    local lineCargoType = ""
                    if carriesCargo then
                        local cNames = {}
                        for _, ct in ipairs(cargoTypes) do
                            if not isPassengerCargo(ct) then table.insert(cNames, ct.name) end
                        end
                        lineCargoType = table.concat(cNames, ", ")
                        if lineCargoType == "" then lineCargoType = "Fracht" end
                    else
                        lineCargoType = "Passagiere"
                    end

                    meta = {
                        name = lName,
                        towns = towns,
                        cargoTypes = cargoTypes,
                        cargoIds = cargoIds,
                        carriesCargo = carriesCargo,
                        carrier = carrier,
                        isOpnv = isOpnv,
                        cargoType = lineCargoType,
                        stopCount = stopCount,
                        vCount = v_count,
                        t = now_t
                    }
                    __line_meta_cache[lid] = meta
                end

                -- Cached Rate & Frequency (Compute once per 25s per line)
                local rateInfo = __line_rate_cache[lid]
                if not rateInfo or (now_t - rateInfo.t > 25) then
                    local rate = 0
                    pcall(function()
                        if api.engine.util and api.engine.util.line and api.engine.util.line.calcLineStationThroughput then
                            local r = api.engine.util.line.calcLineStationThroughput(lid)
                            if r and type(r) == "number" and r > 0 then rate = math.floor(r + 0.5) end
                        end
                    end)
                    local freq = 0
                    pcall(function()
                        if api.engine.util and api.engine.util.line and api.engine.util.line.getMaxFrequency then
                            local f = api.engine.util.line.getMaxFrequency(lid)
                            if f and type(f) == "number" and f > 0 then freq = math.floor((1.0 / f) + 0.5) end
                        end
                    end)
                    local satisfaction = 0
                    pcall(function()
                        if api.engine.util and api.engine.util.cargo and api.engine.util.cargo.getSummarizedCargoQualityDataForLine then
                            local sq = api.engine.util.cargo.getSummarizedCargoQualityDataForLine(lid)
                            if sq then
                                local q = (meta.isOpnv and sq.passengers and sq.passengers.averageQuality) or (sq.cargo and sq.cargo.averageQuality)
                                if q and q > 0 then satisfaction = math.floor(q * 100 + 0.5) end
                            end
                        end
                    end)
                    rateInfo = { rate = rate, freq = freq, satisfaction = satisfaction, t = now_t }
                    __line_rate_cache[lid] = rateInfo
                end

                -- 4. CASHFLOW DELTA
                local cashflowDelta = 0
                local prevT = __last_line_t[lid]
                local evalTime = (worldGameTime and worldGameTime > 0) and worldGameTime or lastIncomeTime
                if not prevT then
                    prevT = evalTime
                else
                    pcall(function()
                        if api.engine.util and api.engine.util.finance and api.engine.util.finance.calculateBalance then
                            if vList and #vList > 0 and evalTime > prevT then
                                local delta = api.engine.util.finance.calculateBalance(vList, prevT, evalTime, true)
                                if delta and type(delta) == "number" then cashflowDelta = delta end
                            end
                        end
                    end)
                end
                __last_line_t[lid] = evalTime

                -- 5. RUNNING COSTS
                local runningCosts = 0
                pcall(function()
                    if api.engine.util and api.engine.util.vehicle and api.engine.util.vehicle.getRunningCost then
                        for _, vid in ipairs(vList) do
                            local rc = api.engine.util.vehicle.getRunningCost(vid)
                            if rc and rc > 0 then runningCosts = runningCosts + rc end
                        end
                    end
                end)

                -- 6. SPEED
                local speedSum = 0
                local maxSpeed = 0
                local validSpeedCount = 0
                pcall(function()
                    if api.engine.util and api.engine.util.vehicle and api.engine.util.vehicle.getSpeed and vList then
                        for _, vid in ipairs(vList) do
                            local spd = api.engine.util.vehicle.getSpeed(vid)
                            if spd and type(spd) == "number" then
                                local kmh = math.floor(spd * 3.6 + 0.5)
                                speedSum = speedSum + kmh
                                if kmh > maxSpeed then maxSpeed = kmh end
                                validSpeedCount = validSpeedCount + 1
                            end
                        end
                    end
                end)
                local avgSpeed = (validSpeedCount > 0) and math.floor((speedSum / validSpeedCount) + 0.5) or 0

                -- 7. OPTIMIZED STOPS & WAITING & WAREHOUSE / STATION TRACKING
                local totalWaiting = 0
                pcall(function()
                    if terminalSys and terminalSys.getLineStopSimEntitiesCount and stopCount > 0 then
                        for sIdx = 0, stopCount - 1 do
                            local stop = (lineComp and lineComp.stops) and lineComp.stops[sIdx + 1] or nil
                            local sgId = stop and stop.stationGroup or nil
                            local stEntry = nil
                            if sgId then
                                stEntry = stationMap[sgId]
                                if not stEntry then
                                    local sName = entityName(sgId) or ("Station " .. tostring(sgId))
                                    local sTown = ""
                                    if station2town then
                                        local stId = stopStation(stop)
                                        sTown = (stId and station2town[stId]) or ""
                                    end
                                    stEntry = {
                                        id = sgId,
                                        name = sName,
                                        town = sTown,
                                        isPax = false,
                                        isCargo = false,
                                        waitingPax = 0,
                                        waitingCargo = 0,
                                        lines = {},
                                        linesMap = {}
                                    }
                                    stationMap[sgId] = stEntry
                                end
                                if not stEntry.linesMap[lid] then
                                    stEntry.linesMap[lid] = true
                                    table.insert(stEntry.lines, meta.name)
                                end
                            end

                            if meta.isOpnv then
                                local cnt = terminalSys.getLineStopSimEntitiesCount(lid, sIdx, 0)
                                if cnt and type(cnt) == "number" and cnt > 0 then
                                    totalWaiting = totalWaiting + cnt
                                    if stEntry then
                                        stEntry.isPax = true
                                        stEntry.waitingPax = stEntry.waitingPax + cnt
                                    end
                                end
                            else
                                local cIds = meta.cargoIds
                                if #cIds == 0 then cIds = { 0 } end
                                for _, cId in ipairs(cIds) do
                                    local cnt = terminalSys.getLineStopSimEntitiesCount(lid, sIdx, cId)
                                    if cnt and type(cnt) == "number" and cnt > 0 then
                                        totalWaiting = totalWaiting + cnt
                                        if stEntry then
                                            stEntry.isCargo = true
                                            stEntry.waitingCargo = stEntry.waitingCargo + cnt
                                        end
                                    end
                                end
                            end
                        end
                    end
                end)

                -- 8. ENGINE LINE ISSUES
                local lineIssue = ""
                pcall(function()
                    if api.engine.util and api.engine.util.line and api.engine.util.line.getLineIssues then
                        local issues = api.engine.util.line.getLineIssues(lid, true)
                        if issues and #issues > 0 then
                            for _, iss in ipairs(issues) do
                                if iss and iss.type then
                                    local s = tostring(iss.type)
                                    if s ~= "None" and #s > 0 then lineIssue = s; break end
                                end
                            end
                        end
                    end
                end)

                local lData = {
                    id = lid,
                    name = meta.name,
                    carrier = meta.carrier,
                    isOpnv = meta.isOpnv,
                    cargoType = meta.cargoType,
                    towns = meta.towns,
                    rate = rateInfo.rate,
                    frequency = rateInfo.freq,
                    satisfaction = rateInfo.satisfaction,
                    cashflow = cashflowDelta,
                    balance = cashflowDelta,
                    runningCosts = runningCosts,
                    avgSpeed = avgSpeed,
                    maxSpeed = maxSpeed,
                    totalWaiting = totalWaiting,
                    lineIssue = lineIssue,
                    vehicleCount = v_count,
                    vehicles = {},
                    load = 0,
                    capacity = 0,
                    utilization = 0,
                    emptyVehicles = 0,
                    loadedVehicles = 0,
                    maintState = 100,
                    costPenalty = 0,
                    avgAgeYears = 0.0
                }

                totalVehicles = totalVehicles + v_count

                local maintSum = 0
                local validMaintCount = 0
                local penaltySum = 0
                local ageSecSum = 0
                local validAgeCount = 0

                for _, vid in ipairs(vList) do
                    -- Vehicle static cache (name, cap, purchaseTime never change)
                    local vStatic = __veh_static_cache[vid]
                    if not vStatic then
                        local vName = "Fzg " .. tostring(vid)
                        pcall(function()
                            local nc = api.engine.getComponent(vid, api.type.ComponentType.NAME)
                            if nc and nc.name and #nc.name > 0 then vName = nc.name end
                        end)
                        local cap = 0
                        pcall(function()
                            local info = tvSys.getInfo(vid)
                            if info and info.cargoInfos then
                                for _, c1 in ipairs(info.cargoInfos) do
                                    if type(c1) == "table" then
                                        for _, c2 in ipairs(c1) do
                                            if (type(c2) == "table" or type(c2) == "userdata") and c2.capacity and c2.capacity > 0 then
                                                cap = cap + math.floor(c2.capacity)
                                            end
                                        end
                                    elseif type(c1) == "userdata" and c1.capacity then
                                        cap = cap + math.floor(c1.capacity)
                                    end
                                end
                            end
                        end)
                        if cap == 0 then
                            pcall(function()
                                local pc = api.engine.getComponent(vid, api.type.ComponentType.PERSON_CAPACITY)
                                if pc and pc.capacity then cap = math.floor(pc.capacity) end
                            end)
                        end
                        local pTime = 0
                        pcall(function()
                            local tv = api.engine.getComponent(vid, api.type.ComponentType.TRANSPORT_VEHICLE)
                            if tv and tv.transportVehicleConfig and tv.transportVehicleConfig.vehicles then
                                local p = tv.transportVehicleConfig.vehicles[1]
                                if p and p.purchaseTime then pTime = p.purchaseTime end
                            end
                        end)
                        vStatic = { name = vName, cap = cap, purchaseTime = pTime }
                        __veh_static_cache[vid] = vStatic
                    end

                    -- MAINTENANCE
                    local vMaint = 1.0
                    local vPenalty = 0
                    pcall(function()
                        if api.engine.util and api.engine.util.vehicle and api.engine.util.vehicle.getVehicleMaintenanceState then
                            local ms = api.engine.util.vehicle.getVehicleMaintenanceState(vid)
                            if ms and type(ms) == "number" then
                                vMaint = ms
                                maintSum = maintSum + ms
                                validMaintCount = validMaintCount + 1
                                if api.engine.util.vehicle.getMaintenanceRunningCostPenalty then
                                    local cp = api.engine.util.vehicle.getMaintenanceRunningCostPenalty(ms)
                                    if cp and type(cp) == "number" then
                                        if cp <= 1.0 and cp > 0 then cp = cp * 100 end
                                        vPenalty = math.floor(cp + 0.5)
                                        penaltySum = penaltySum + vPenalty
                                    end
                                end
                            end
                        end
                    end)

                    -- FLEET AGE
                    local vAgeSec = 0
                    if vStatic.purchaseTime > 0 and lastIncomeTime >= vStatic.purchaseTime then
                        local diff = lastIncomeTime - vStatic.purchaseTime
                        ageSecSum = ageSecSum + diff
                        validAgeCount = validAgeCount + 1
                        vAgeSec = diff
                    end

                    -- LOAD
                    local load = 0
                    if v2cMap and v2cMap[vid] then
                        local cMap = v2cMap[vid]
                        if type(cMap) == "table" then
                            for _, simList in pairs(cMap) do
                                if type(simList) == "number" then load = load + simList
                                elseif type(simList) == "table" then load = load + #simList end
                            end
                        end
                    end

                    if load == 0 and simSys and simSys.getVehicleSimEntitiesCount then
                        pcall(function()
                            local c = simSys.getVehicleSimEntitiesCount(vid)
                            if type(c) == "table" then
                                for _, cnt in pairs(c) do
                                    if type(cnt) == "number" then load = load + cnt
                                    elseif type(cnt) == "table" then load = load + #cnt end
                                end
                            elseif type(c) == "number" and c > 0 then load = load + c end
                        end)
                    end

                    if load == 0 then lData.emptyVehicles = lData.emptyVehicles + 1
                    else lData.loadedVehicles = lData.loadedVehicles + 1 end
                    lData.load = lData.load + load
                    lData.capacity = lData.capacity + vStatic.cap

                    if #lData.vehicles < 5 then
                        table.insert(lData.vehicles, {
                            id = vid,
                            name = vStatic.name,
                            load = load,
                            capacity = vStatic.cap,
                            maintState = math.floor(vMaint * 100 + 0.5),
                            costPenalty = vPenalty,
                            ageYears = math.floor((vAgeSec / 730000.0) * 10 + 0.5) / 10.0
                        })
                    end
                end

                if validMaintCount > 0 then
                    lData.maintState = math.floor((maintSum / validMaintCount) * 100 + 0.5)
                    lData.costPenalty = math.floor((penaltySum / validMaintCount) + 0.5)
                end

                if validAgeCount > 0 then
                    lData.avgAgeYears = math.floor(((ageSecSum / validAgeCount) / 730000.0) * 10 + 0.5) / 10.0
                end

                if lData.capacity > 0 then
                    lData.utilization = math.floor((lData.load / lData.capacity) * 100)
                end

                if lData.vehicleCount > 0 then
                    lData.directionalRatio = math.floor((lData.loadedVehicles / lData.vehicleCount) * 100) / 100.0
                end

                if lData.frequency == 0 and lData.rate > 0 and lData.capacity > 0 and lData.vehicleCount > 0 then
                    lData.frequency = math.max(1, math.floor((lData.capacity * 360) / (lData.rate * lData.vehicleCount)))
                end

                table.insert(linesList, lData)

                if meta.isOpnv then
                    paxSummary.load = paxSummary.load + lData.load
                    paxSummary.capacity = paxSummary.capacity + lData.capacity
                    paxSummary.waiting = paxSummary.waiting + lData.totalWaiting
                    paxSummary.lineCount = paxSummary.lineCount + 1
                    paxSummary.vehicleCount = paxSummary.vehicleCount + lData.vehicleCount
                else
                    cargoSummary.load = cargoSummary.load + lData.load
                    cargoSummary.capacity = cargoSummary.capacity + lData.capacity
                    cargoSummary.waiting = cargoSummary.waiting + lData.totalWaiting
                    cargoSummary.lineCount = cargoSummary.lineCount + 1
                    cargoSummary.vehicleCount = cargoSummary.vehicleCount + lData.vehicleCount
                end
            end)
        end

        paxSummary.util = (paxSummary.capacity > 0) and math.floor((paxSummary.load / paxSummary.capacity) * 100) or 0
        cargoSummary.util = (cargoSummary.capacity > 0) and math.floor((cargoSummary.load / cargoSummary.capacity) * 100) or 0

        local stationList = {}
        for _, st in pairs(stationMap) do
            st.linesMap = nil
            st.totalWaiting = st.waitingPax + st.waitingCargo
            table.insert(stationList, st)
        end
        table.sort(stationList, function(a, b) return a.totalWaiting > b.totalWaiting end)

        -- Calculate realistic loan interest if loan exists
        if companyFinances.loan and companyFinances.loan > 0 then
            local annInterest = 0
            if companyFinances.interestByYear and #companyFinances.interestByYear > 0 then
                annInterest = math.abs(companyFinances.interestByYear[#companyFinances.interestByYear])
            end
            if annInterest == 0 then
                annInterest = math.floor(companyFinances.loan * 0.015 + 0.5)
            end
            companyFinances.interest = annInterest
            companyFinances.interestPerMonth = math.floor(annInterest / 12 + 0.5)
            companyFinances.interestRate = 1.5
        else
            companyFinances.interest = 0
            companyFinances.interestPerMonth = 0
            companyFinances.interestRate = 0
        end

        -- DYNAMIC ADAPTIVE INTERVAL TUNING
        local bal_diff = math.abs(companyFinances.bankBalance - __last_balance)
        local totalLines = #linesList
        if bal_diff < 5000 and totalVehicles == __last_veh_count and totalLines == __last_lines_count and not isPaused then
            __unchanged_count = __unchanged_count + 1
            if __unchanged_count >= 15 then __current_interval = 25.0
            elseif __unchanged_count >= 8 then __current_interval = 15.0
            elseif __unchanged_count >= 4 then __current_interval = 10.0
            elseif __unchanged_count >= 2 then __current_interval = 7.0
            end
        else
            __unchanged_count = 0
            __current_interval = __min_interval
        end

        __last_balance = companyFinances.bankBalance
        __last_veh_count = totalVehicles
        __last_lines_count = totalLines

        local payload = {
            timestamp = os.time(),
            gameTime = (worldGameTime > 0) and worldGameTime or lastIncomeTime,
            gameDate = gameDateStr,
            playDuration = playDurationStr,
            isPaused = isPaused,
            simSpeed = simSpeed,
            currentInterval = __current_interval,
            source = "TF3 MOD ENGINE LIVE",
            totalVehicles = totalVehicles,
            totalLines = #linesList,
            paxSummary = paxSummary,
            cargoSummary = cargoSummary,
            stations = stationList,
            finances = companyFinances,
            stats = companyStats,
            lines = linesList
        }

        local json_str = serialize_json(payload)

        pcall(function()
            local f, err = io.open(__json_path, "w")
            if f then
                f:write(json_str)
                f:close()
                print("[TF3_TELEMETRY] Exported " .. tostring(#linesList) .. " lines to file")
            else
                print("[TF3_TELEMETRY] io.open failed: " .. tostring(err))
            end
        end)

        print("[TF3_LIVE_TELEMETRY]" .. json_str)
    end)
    if not ok then
        print("[TF3_TELEMETRY_ERROR] " .. tostring(err))
    end
end

local script_def = {
    update = function(userParams, state, dt)
        export_telemetry_tick(dt)
    end,
    handleEvent = function(userParams, state, src, id, name, param)
    end
}

function data()
    return script_def
end

return script_def
"""

telemetry_gs_code = """function data()
    return {
        updateScript = {
            fileName = "telemetry.script@update"
        },
        handleEventScript = {
            fileName = "telemetry.script@handleEvent"
        }
    }
end
"""

# 1. Deploy directly to project repository (companion-mod/tf3_telemetry)
os.makedirs(os.path.join(COMPANION_MOD_DIR, "content"), exist_ok=True)
with open(os.path.join(COMPANION_MOD_DIR, "content", "telemetry.script.lua"), "w", encoding="utf-8") as f:
    f.write(telemetry_script_code)

with open(os.path.join(COMPANION_MOD_DIR, "content", "telemetry.gs.lua"), "w", encoding="utf-8") as f:
    f.write(telemetry_gs_code)

# 2. Write directly to workspace for dynamic live hook
workspace_live_lua = os.path.join(SCRIPT_DIR, "telemetry.live.lua")
with open(workspace_live_lua, "w", encoding="utf-8") as f:
    f.write(telemetry_script_code)

# 3. If game mod directory exists or was detected, deploy there as well
if target_mod_dir:
    game_content = os.path.join(target_mod_dir, "content")
    os.makedirs(game_content, exist_ok=True)
    with open(os.path.join(game_content, "telemetry.script.lua"), "w", encoding="utf-8") as f:
        f.write(telemetry_script_code)
    with open(os.path.join(game_content, "telemetry.gs.lua"), "w", encoding="utf-8") as f:
        f.write(telemetry_gs_code)

    mod_json_path = os.path.join(target_mod_dir, "mod.json")
    mod_json_data = {
        "autoActivate": True,
        "cosmetic": True,
        "dependencies": None,
        "incompatibilities": None,
        "modId": "tf3_telemetry_1",
        "options": None,
        "params": None,
        "postRunScript": {"fileName": ""},
        "preRunScript": {"fileName": ""},
        "revision": 5,
        "runScript": {"fileName": "tf3_telemetry_1::/mod.script@runFn"},
        "severityAdd": "None",
        "severityRemove": "None"
    }
    with open(mod_json_path, "w", encoding="utf-8") as f:
        json.dump(mod_json_data, f, indent=4)
    print(f"DEPLOYED to game mod directory: {target_mod_dir}")
else:
    print("NOTE: No game folder detected automatically. Mod files generated cleanly in companion-mod/tf3_telemetry")

print("SUCCESS: Ultra-optimized, adaptive telemetry deployed to companion-mod & workspace!")
