"""Python bot 的最小桥接示例；生成 PNG 字节后交给原框架发送。"""
import json
from pathlib import Path
import subprocess

MODULE = Path(__file__).resolve().parent.parent


def render_menu(mode, inventory, balance=None, page=1, selected_id=None):
    state = {"mode": mode, "inventory": inventory, "page": page}
    if balance is not None:
        state["balance"] = balance
    if selected_id is not None:
        state["selectedId"] = selected_id
    result = subprocess.run(
        ["node", str(MODULE / "cli.cjs")],
        input=json.dumps(state, ensure_ascii=False).encode("utf-8"),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    return result.stdout  # PNG bytes，交给原 bot 的图片消息接口。


if __name__ == "__main__":
    (MODULE / "preview" / "python-example.png").write_bytes(
        render_menu("shop", {"觉fumo": 1}, balance=52000)
    )
