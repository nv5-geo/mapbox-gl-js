// @flow

import assert from 'assert';
import {isValue, typeOf} from '../values';

import type {Type} from '../types';
import {BooleanType} from '../types';
import type {Expression} from '../expression';
import type ParsingContext from '../parsing_context';
import type EvaluationContext from '../evaluation_context';
import {CanonicalTileID} from '../../../source/tile_id';
// import geojson from '../source/geojson_source';
import type {GeoJSON, GeoJSONFeature} from '@mapbox/geojson-types';
import type {Feature} from '../index';
import MercatorCoordinate from '../../../geo/mercator_coordinate';
import EXTENT from '../../../data/extent';
import Point from '@mapbox/point-geometry';

// ray casting algorithm for detecting if point is in polygon
function pointWithinPolygon(polygon, p) {
    const rings = polygon.coordinates;
    var inside = false;
    for (var i = 0, len = rings.length; i < len; i++) {
        var ring = rings[i];
        for (var j = 0, len2 = ring.length, k = len2 - 1; j < len2; k = j++) {
            if (rayIntersect(p, ring[j], ring[k])) inside = !inside;
        }
    }
    return inside;
}

function rayIntersect(p, p1, p2) {
    return ((p1[1] > p[1]) !== (p2[1] > p[1])) && (p[0] < (p2[0] - p1[0]) * (p[1] - p1[1]) / (p2[1] - p1[1]) + p1[0]);
}

function getMercatorPoint(coord: Point, canonical: CanonicalTileID) {
    const tilesAtZoom = Math.pow(2, canonical.z);
    const x = (coord.x / EXTENT + canonical.x) / tilesAtZoom;
    const y = (coord.y / EXTENT + canonical.y) / tilesAtZoom;
    return new MercatorCoordinate(x, y);
}

function pointsWithinPolygons(feature: Feature, canonical: CanonicalTileID, polygonGeometry: GeoJSON) {
    if (polygonGeometry.type === 'Polygon') {
        if (feature != null && feature.type === 'Point') {
            return pointWithinPolygon(polygonGeometry, getMercatorPoint(feature.geometry, canonical).toLngLat());
        }
    }
    return false;
}

class Within implements Expression {
    type: Type;
    geojson: GeoJSON;

    constructor(geojson: GeoJSON) {
        this.type = BooleanType;
        this.geojson = geojson;
    }

    static parse(args: $ReadOnlyArray<mixed>, context: ParsingContext) {
        if (args.length !== 2)
            return context.error(`'within' expression requires exactly one argument, but found ${args.length - 1} instead.`);

        if (!isValue(args[1]) || typeOf(args[1] !== 'Object'))
            return context.error(`'within' expression requires valid geojson source that contains polygon geometry type.`);

        const value = (args[1]: Object);
        if (value.type !== 'Polygon') {
            return context.error(`'within' expression requires valid geojson source that contains polygon geometry type.`);
        }
        return new Within(value);
    }

    evaluate(ctx: EvaluationContext) {

        const geometryType = ctx.geometryType();
        if (geometryType === 'Point' && ctx.feature != null && ctx.canonical != null) {
            return pointsWithinPolygons(ctx.feature, ctx.canonical, this.geojson);
        } else if (geometryType === 'LineString') {
            return true;
        }
        return false;
    }

    eachChild() {}

    possibleOutputs() {
        return [true, false];
    }

    serialize(): Array<mixed> {
        return ["within", this.geojson];
    }

}

export default Within;
