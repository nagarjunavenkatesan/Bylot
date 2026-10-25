const asyncHandler = require("../utils/asyncHandler");
const { success } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");
const {
  ALL_INDIA_REGIONS,
  INDIA_STATES,
  INDIA_UNION_TERRITORIES,
  isValidStateOrUT,
  resolveCanonicalState,
  getRegionDetails,
  getDistrictsForRegion
} = require("../config/indiaLocations");

/**
 * Returns all canonical 28 Indian States and 8 Union Territories.
 * GET /api/locations/states
 */
const getStatesAndUTs = asyncHandler(async (req, res) => {
  const regions = ALL_INDIA_REGIONS.map((r) => ({
    code: r.code,
    name: r.name,
    type: r.type
  })).sort((a, b) => a.name.localeCompare(b.name));

  return success(res, "States and Union Territories fetched successfully", {
    country: "India",
    totalStates: INDIA_STATES.length,
    totalUnionTerritories: INDIA_UNION_TERRITORIES.length,
    totalRegions: regions.length,
    regions
  });
});

/**
 * Returns districts for a given State or Union Territory code/name.
 * GET /api/locations/states/:codeOrState/districts
 */
const getDistricts = asyncHandler(async (req, res) => {
  const { codeOrState } = req.params;
  const region = getRegionDetails(codeOrState);

  if (!region) {
    throw new AppError(`Invalid State or Union Territory: '${codeOrState}'. Must be a valid Indian state or UT.`, 400);
  }

  const districts = getDistrictsForRegion(region.code);

  return success(res, `Districts for ${region.name} fetched successfully`, {
    country: "India",
    state: region.name,
    code: region.code,
    type: region.type,
    districts
  });
});

/**
 * Verifies whether a given state string is valid.
 * GET /api/locations/verify?state=...
 */
const verifyLocation = asyncHandler(async (req, res) => {
  const stateInput = req.query.state || req.body?.state;
  if (!stateInput) {
    throw new AppError("Missing state parameter for verification", 400);
  }

  const isValid = isValidStateOrUT(stateInput);
  if (!isValid) {
    return res.status(400).json({
      success: false,
      message: `'${stateInput}' is not a valid Indian State or Union Territory.`,
      data: { valid: false, input: stateInput }
    });
  }

  const canonicalName = resolveCanonicalState(stateInput);
  const details = getRegionDetails(stateInput);

  return success(res, "State verified successfully", {
    valid: true,
    canonicalState: canonicalName,
    code: details?.code,
    type: details?.type,
    country: "India"
  });
});

module.exports = {
  getStatesAndUTs,
  getDistricts,
  verifyLocation
};
