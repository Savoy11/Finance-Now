"""
Tests for the four scoring components, which sat at 28–45% coverage.

Each component is a thin weighted fold over an analytics module: it decides the
WEIGHTS, the no-data penalty, and the clamp. Those three decisions are what
these tests pin — not the analytics maths underneath, which has its own tests.

The weights matter because they are the product's judgement about what makes a
stablecoin risky, and a silent change to one reweights every published score.
"""
from __future__ import annotations

from datetime import date, timedelta

from app.scoring.components.network_velocity import compute_network_velocity_score
from app.scoring.components.peg_liquidity import compute_peg_liquidity_score
from app.scoring.components.reserve_transparency import compute_reserve_transparency_score
from app.scoring.components.security_compliance import compute_security_compliance_score


def _in_range(score: float) -> bool:
    return 0.0 <= score <= 100.0


class TestReserveTransparency:
    def test_declares_its_component_weight(self):
        # 35% — the largest single weight in the model. If this changes, every
        # historical score becomes incomparable to a new one.
        _, breakdown = compute_reserve_transparency_score({}, None, None)
        assert breakdown["weight"] == 0.35
        assert breakdown["component"] == "reserve_transparency"

    def test_a_real_time_feed_earns_a_bounded_bonus(self):
        args = ({"cash": 100.0}, 1.02, date.today(), "big4")
        without, _ = compute_reserve_transparency_score(*args, has_real_time_feed=False)
        with_feed, bd = compute_reserve_transparency_score(*args, has_real_time_feed=True)
        assert with_feed >= without
        assert with_feed - without <= 5.0
        assert bd["has_real_time_feed"] is True

    def test_the_bonus_cannot_push_a_score_past_100(self):
        score, _ = compute_reserve_transparency_score(
            {"cash": 100.0},
            1.5,
            date.today(),
            "big4",
            has_real_time_feed=True,
        )
        assert _in_range(score)

    def test_no_data_still_returns_a_score_in_range(self):
        score, bd = compute_reserve_transparency_score({}, None, None)
        assert _in_range(score)
        assert "sub_scores" in bd

    def test_a_stale_attestation_does_not_score_above_a_fresh_one(self):
        fresh, _ = compute_reserve_transparency_score({"cash": 100.0}, 1.0, date.today(), "big4")
        stale, _ = compute_reserve_transparency_score(
            {"cash": 100.0},
            1.0,
            date.today() - timedelta(days=900),
            "big4",
        )
        assert stale <= fresh


class TestPegLiquidity:
    def test_declares_its_component_weight(self):
        _, bd = compute_peg_liquidity_score([], 1.0, None, None, None, None, None)
        assert bd["weight"] == 0.30
        assert bd["component"] == "peg_liquidity"

    def test_an_empty_price_series_scores_neutral_not_zero(self):
        # 50.0, not 0. "We have no price history" must not render as "this peg
        # has completely failed" — the same rule the frontend applies to a
        # missing figure.
        _, bd = compute_peg_liquidity_score([], 1.0, None, None, None, None, None)
        assert bd["peg_score"] == 50.0
        assert bd["peg_observations"] == 0

    def test_reports_how_many_observations_the_peg_score_rests_on(self):
        _, bd = compute_peg_liquidity_score([1.0, 1.001, 0.999], 1.0, None, None, None, None, None)
        assert bd["peg_observations"] == 3

    def test_a_held_peg_scores_above_a_broken_one(self):
        held, _ = compute_peg_liquidity_score([1.0, 1.0, 1.001], 1.0, None, None, None, None, None)
        broken, _ = compute_peg_liquidity_score(
            [1.0, 0.82, 0.71], 1.0, None, None, None, None, None
        )
        assert held > broken

    def test_the_composite_is_the_declared_55_45_blend(self):
        score, bd = compute_peg_liquidity_score(
            [1.0, 1.0],
            1.0,
            5_000_000.0,
            9_000_000.0,
            1_000_000_000.0,
            5.0,
            2.0,
        )
        expected = bd["peg_score"] * 0.55 + bd["liquidity_score"] * 0.45
        assert abs(score - expected) < 0.01

    def test_stays_in_range_on_absent_liquidity_data(self):
        score, _ = compute_peg_liquidity_score([1.0], 1.0, None, None, None, None, None)
        assert _in_range(score)


class TestNetworkVelocity:
    def test_declares_its_component_weight(self):
        _, bd = compute_network_velocity_score(None, None, None, None, None, None, None)
        assert bd["weight"] == 0.20
        assert bd["component"] == "network_velocity"

    def test_the_composite_is_the_declared_60_40_blend(self):
        score, bd = compute_network_velocity_score(2.5, 50_000, 500_000, 200_000, 0.6, 1200.0, 35.0)
        expected = bd["network_activity_score"] * 0.60 + bd["concentration_score"] * 0.40
        assert abs(score - expected) < 0.01

    def test_absent_concentration_metrics_are_reported_as_none_not_zero(self):
        # A rounded 0.0 would read as "perfectly distributed", which is the
        # opposite of "we could not measure the distribution".
        _, bd = compute_network_velocity_score(1.0, 100, 1000, 500, None, None, None)
        assert bd["gini"] is None
        assert bd["hhi"] is None
        assert bd["top_10_pct"] is None

    def test_rounds_the_metrics_it_does_have(self):
        _, bd = compute_network_velocity_score(1.0, 100, 1000, 500, 0.123456789, 1234.5678, 44.4444)
        assert bd["gini"] == 0.1235
        assert bd["hhi"] == 1234.57
        assert bd["top_10_pct"] == 44.44

    def test_concentrated_holdings_score_no_better_than_dispersed_ones(self):
        dispersed, _ = compute_network_velocity_score(
            2.0, 50_000, 500_000, 200_000, 0.35, 400.0, 12.0
        )
        whale_held, _ = compute_network_velocity_score(
            2.0, 50_000, 500_000, 200_000, 0.95, 8500.0, 92.0
        )
        assert whale_held <= dispersed

    def test_stays_in_range_with_no_data_at_all(self):
        score, _ = compute_network_velocity_score(None, None, None, None, None, None, None)
        assert _in_range(score)


class TestSecurityCompliance:
    def test_declares_its_component_weight(self):
        _, bd = compute_security_compliance_score(None, None, None, None)
        assert bd["weight"] == 0.15
        assert bd["component"] == "security_compliance"

    def test_missing_data_is_penalised_at_30_not_treated_as_neutral(self):
        # The design decision worth pinning: absent security data scores 30, not
        # 50. An unaudited contract is not "average risk" — nobody has checked.
        score, bd = compute_security_compliance_score(None, None, None, None)
        assert bd["smart_contract_score"] == 30.0
        assert bd["counterparty_score"] == 30.0
        assert score == 30.0

    def test_the_composite_is_the_declared_50_50_blend(self):
        score, bd = compute_security_compliance_score(
            {
                "audits": [{"firm": "OpenZeppelin", "date": "2024-01-01"}],
                "is_multisig": True,
                "signer_count": 5,
                "threshold": 3,
                "has_timelock": True,
                "timelock_hours": 48,
                "oracle_count": 3,
                "oracle_types": ["chainlink"],
                "has_circuit_breaker": True,
            },
            {"name": "Example Issuer"},
            {"type": "qualified"},
            {"licenses": ["NYDFS"]},
        )
        expected = bd["smart_contract_score"] * 0.50 + bd["counterparty_score"] * 0.50
        assert abs(score - expected) < 0.01

    def test_smart_contract_data_alone_still_penalises_the_counterparty_half(self):
        _, bd = compute_security_compliance_score(
            {"audits": [], "oracle_count": 1},
            None,
            None,
            None,
        )
        assert bd["counterparty_score"] == 30.0
        assert bd["counterparty_detail"] == {}

    def test_counterparty_data_alone_still_penalises_the_contract_half(self):
        _, bd = compute_security_compliance_score(None, {"name": "Example"}, None, None)
        assert bd["smart_contract_score"] == 30.0
        assert bd["smart_contract_detail"] == {}

    def test_any_one_counterparty_input_is_enough_to_score_that_half(self):
        for kwargs in (
            {"issuer_data": {"name": "X"}},
            {"custodian_data": {"type": "qualified"}},
            {"compliance_data": {"licenses": ["NYDFS"]}},
        ):
            _, bd = compute_security_compliance_score(
                None,
                **{
                    "issuer_data": None,
                    "custodian_data": None,
                    "compliance_data": None,
                    **kwargs,
                },
            )
            assert bd["counterparty_detail"] != {}, kwargs

    def test_stays_in_range_on_rich_input(self):
        score, _ = compute_security_compliance_score(
            {
                "audits": [{"firm": "Trail of Bits"}] * 5,
                "is_multisig": True,
                "signer_count": 9,
                "threshold": 6,
                "has_timelock": True,
                "timelock_hours": 72,
                "oracle_count": 5,
                "oracle_types": ["chainlink", "pyth"],
                "has_circuit_breaker": True,
            },
            {"name": "X"},
            {"type": "qualified"},
            {"licenses": ["NYDFS", "MiCA"]},
        )
        assert _in_range(score)


class TestComponentWeightsSumToOne:
    def test_the_four_declared_weights_sum_to_1_0(self):
        # 0.35 + 0.30 + 0.20 + 0.15. If they ever stop summing to 1, the
        # composite silently stops being a 0–100 score and no single component
        # test would catch it.
        weights = [
            compute_reserve_transparency_score({}, None, None)[1]["weight"],
            compute_peg_liquidity_score([], 1.0, None, None, None, None, None)[1]["weight"],
            compute_network_velocity_score(None, None, None, None, None, None, None)[1]["weight"],
            compute_security_compliance_score(None, None, None, None)[1]["weight"],
        ]
        assert abs(sum(weights) - 1.0) < 1e-9
