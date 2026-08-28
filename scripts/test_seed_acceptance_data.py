import importlib.util
import unittest
from pathlib import Path


def load_seed_module():
    script_path = Path(__file__).with_name("seed-acceptance-data.py")
    spec = importlib.util.spec_from_file_location("seed_acceptance_data", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class AcceptanceSeedRackCountsTests(unittest.TestCase):
    def test_kept_rooms_define_required_rack_counts(self):
        seed = load_seed_module()
        self.assertEqual(
            seed.KEPT_ROOMS,
            [
                ("上海机房", "上海张江DC1", "SH", "R1", 100),
                ("北京机房", "北京", "BJ", "R2", 150),
                ("广州机房", "广州", "GZ", "R3", 80),
            ],
        )
        self.assertEqual(sum(room[4] for room in seed.KEPT_ROOMS), 330)


if __name__ == "__main__":
    unittest.main()
