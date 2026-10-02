type ColorProperty = "background-color" | "fill-color" | "line-color";

interface PaintRule {
  layer: string;
  property: ColorProperty;
  value: string;
}

const land = "#f7efd9";
const street = "#fffaf0";
const water = "#cfe0d4";

export const mapPalette = {
  land,
  label: "#5a3a22",
  hidden: ["highway-shield-non-us", "highway-shield-us-interstate", "road_shield_us", "airport"],
  rules: [
    { layer: "background", property: "background-color", value: land },
    { layer: "landuse_residential", property: "fill-color", value: land },
    { layer: "park", property: "fill-color", value: "#d9e3c0" },
    { layer: "landcover_wood", property: "fill-color", value: "#dfe6c6" },
    { layer: "water", property: "fill-color", value: water },
    { layer: "waterway", property: "line-color", value: water },
    { layer: "building", property: "fill-color", value: "#efe3c4" },
    { layer: "highway_path", property: "line-color", value: "#e3cf9f" },
    { layer: "highway_minor", property: "line-color", value: street },
    { layer: "highway_major_casing", property: "line-color", value: "#e3cf9f" },
    { layer: "highway_major_inner", property: "line-color", value: street },
    { layer: "highway_major_subtle", property: "line-color", value: "#e8c98f" },
    { layer: "highway_motorway_casing", property: "line-color", value: "#d9b97a" },
    { layer: "highway_motorway_inner", property: "line-color", value: "#e8c98f" },
    { layer: "highway_motorway_subtle", property: "line-color", value: "#e8c98f" },
    { layer: "railway", property: "line-color", value: "#d6c39a" },
    { layer: "railway_dashline", property: "line-color", value: land },
    { layer: "boundary_3", property: "line-color", value: "#9c6b43" },
    { layer: "boundary_2", property: "line-color", value: "#9c6b43" },
  ] satisfies PaintRule[],
};
