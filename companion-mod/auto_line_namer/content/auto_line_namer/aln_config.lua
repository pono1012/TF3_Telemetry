-- Auto Line Namer (Cities First Edition) settings.
-- Based on Auto Line Namer by Dave W (BeautifulCheez) & Erkan Ercan (MIT License).
-- Customized so townNames come first.
--
-- Edit with the game closed, then reload your save. The Naming Convention, Town Names,
-- Cargo Names and Auto Update choices are made in the mod's options when you add it to a game;
-- everything else lives here.
--
-- Tokens you can use in customConvention:
--   {transportType}  label for the vehicle type (see transportType below)
--   {cargoTypes}     the cargo the line carries, joined with cargoSeparator
--   {townNames}      first and last town on the line, joined with townSeparator
--   {lineType}       local / intercity / regional label (see lineType below)
--   {lineNumber}     1 for the first line with this name, 2 for the next, and so on

return {
	-- Used when "Naming Convention" is set to "Custom (config file)".
	customConvention = "{townNames} - {transportType} {cargoTypes}-{lineType}-{lineNumber}",

	-- Lines whose name starts with this are never renamed. Case sensitive.
	-- If empty, only lines with default names (empty, "Line 12", r, reload) are renamed.
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

	-- A line is local if all its stops are in one town, intercity for two towns, regional for more.
	lineType = {
		localLineAddon = "LO",
		intercityLineAddon = "IC",
		regionalLineAddon = "RE",
	},

	cargoSeparator = ",",
	townSeparator = "-",

	-- Show at most this many cargo types, then "+N". 0 shows all of them.
	maxCargoTypes = 3,
}
