"""
Tests for app/scoring/normalizer.py, which was at 0% coverage.

The repo's own convention is that anything producing a figure a user acts on
should be pure and tested. These four functions are the purest code in the
backend and had no tests at all, which is how the all-NaN crash fixed alongside
these tests survived unnoticed.
"""
from __future__ import annotations

import math

import pytest

from app.scoring.normalizer import (
    clamp,
    min_max_normalize,
    normalize_series,
    z_score_normalize,
)


class TestMinMaxNormalize:
    def test_maps_the_domain_onto_the_target_range(self):
        assert min_max_normalize(0, 0, 10) == 0.0
        assert min_max_normalize(5, 0, 10) == 50.0
        assert min_max_normalize(10, 0, 10) == 100.0

    def test_clamps_outside_the_domain_rather_than_extrapolating(self):
        # A score above 100 or below 0 would break every downstream band.
        assert min_max_normalize(-5, 0, 10) == 0.0
        assert min_max_normalize(15, 0, 10) == 100.0

    def test_a_degenerate_domain_returns_the_midpoint_not_a_division_by_zero(self):
        # min == max carries no information about where the value sits, so the
        # midpoint is the only honest answer — and notably NOT 0, which would
        # read as "worst possible".
        assert min_max_normalize(7, 5, 5) == 50.0
        assert min_max_normalize(7, 5, 5, target_min=0, target_max=10) == 5.0

    def test_honours_a_custom_target_range(self):
        assert min_max_normalize(5, 0, 10, target_min=-1, target_max=1) == 0.0
        assert min_max_normalize(10, 0, 10, target_min=-1, target_max=1) == 1.0

    def test_handles_a_reversed_or_negative_domain(self):
        assert min_max_normalize(-5, -10, 0) == 50.0


class TestZScoreNormalize:
    def test_measures_distance_from_the_mean_in_standard_deviations(self):
        assert z_score_normalize(10, 10, 2) == 0.0
        assert z_score_normalize(12, 10, 2) == 1.0
        assert z_score_normalize(8, 10, 2) == -1.0

    def test_clips_at_the_sigma_bound_in_both_directions(self):
        # Without clipping one outlier dominates every comparison built on it.
        assert z_score_normalize(100, 10, 2) == 3.0
        assert z_score_normalize(-100, 10, 2) == -3.0
        assert z_score_normalize(100, 10, 2, clip_sigma=1.5) == 1.5

    def test_zero_standard_deviation_returns_zero_not_infinity(self):
        # Every observation identical: the value is exactly average by
        # definition, and dividing by zero would poison the whole series.
        assert z_score_normalize(10, 10, 0) == 0.0
        assert z_score_normalize(999, 10, 0) == 0.0

    def test_returns_a_float_not_a_numpy_scalar(self):
        assert isinstance(z_score_normalize(12, 10, 2), float)


class TestNormalizeSeries:
    def test_empty_series_returns_empty(self):
        assert normalize_series([]) == []

    def test_minmax_spreads_the_series_across_the_full_range(self):
        assert normalize_series([0.0, 5.0, 10.0]) == [0.0, 50.0, 100.0]

    def test_zscore_centres_the_series_on_its_own_mean(self):
        out = normalize_series([1.0, 2.0, 3.0], method="zscore")
        assert out[1] == pytest.approx(0.0)
        assert out[0] < 0 < out[2]

    def test_nan_entries_pass_through_and_are_excluded_from_the_statistics(self):
        # The bounds must come from the real readings only; letting a NaN reach
        # min()/max() would make every output NaN.
        out = normalize_series([0.0, float("nan"), 10.0])
        assert out[0] == 0.0
        assert math.isnan(out[1])
        assert out[2] == 100.0

    def test_an_all_nan_series_returns_all_nan_instead_of_crashing(self):
        # REGRESSION (fixed 2026-09-08). minmax — the DEFAULT method — raised
        # "zero-size array to reduction operation minimum", and zscore limped
        # through on a NaN mean while emitting a RuntimeWarning. An all-NaN
        # series is what a metric with no readings for any asset looks like, so
        # it is a plausible input rather than an abuse.
        out = normalize_series([float("nan"), float("nan")])
        assert len(out) == 2
        assert all(math.isnan(v) for v in out)

        out_z = normalize_series([float("nan")], method="zscore")
        assert len(out_z) == 1
        assert math.isnan(out_z[0])

    def test_a_single_value_series_does_not_divide_by_a_zero_sample_stdev(self):
        # ddof=1 on one observation is undefined; the code substitutes 1.0.
        assert normalize_series([5.0], method="zscore") == [0.0]

    def test_a_constant_series_reports_the_midpoint_under_minmax(self):
        assert normalize_series([7.0, 7.0, 7.0]) == [50.0, 50.0, 50.0]

    def test_a_constant_series_reports_zero_under_zscore(self):
        assert normalize_series([7.0, 7.0], method="zscore") == [0.0, 0.0]

    def test_an_unknown_method_raises_rather_than_guessing(self):
        with pytest.raises(ValueError, match="Unknown normalisation method"):
            normalize_series([1.0, 2.0], method="percentile")

    def test_output_length_always_matches_input_length(self):
        # Positional alignment is the contract — a caller zips these back
        # against asset ids, so a dropped element mislabels every row after it.
        for series in ([1.0], [1.0, 2.0, 3.0], [1.0, float("nan"), 3.0], [float("nan")] * 4):
            for method in ("minmax", "zscore"):
                assert len(normalize_series(series, method=method)) == len(series)


class TestClamp:
    def test_bounds_to_the_default_score_range(self):
        assert clamp(-10) == 0.0
        assert clamp(50) == 50.0
        assert clamp(150) == 100.0

    def test_honours_custom_bounds(self):
        assert clamp(-5, lo=-1, hi=1) == -1.0
        assert clamp(0.5, lo=-1, hi=1) == 0.5

    def test_returns_a_float_even_for_an_int_input(self):
        assert isinstance(clamp(50), float)
