extensions = ["myst_parser", "jupyterlite_sphinx"]

jupyterlite_config = "jupyter_lite_config.json"
jupyterlite_dir = "."
jupyterlite_contents = "content"

master_doc = "index"
source_suffix = ".md"

# General information about the project.
project = "JupyterLab Plugin Playground"
author = "Project Jupyter"

exclude_patterns = []
highlight_language = "python"
pygments_style = "sphinx"

html_theme = "pydata_sphinx_theme"
html_static_path = ["_static"]

html_css_files = ["custom.css"]


def _ensure_extension_examples(root):
    import shutil
    import subprocess

    examples = root / "extension-examples"
    if (examples / "README.md").exists():
        return examples

    if (root / ".git").exists():
        subprocess.call(
            [
                "git",
                "submodule",
                "update",
                "--init",
                "--recursive",
                "extension-examples",
            ],
            cwd=str(root),
        )

    if (examples / "README.md").exists():
        return examples

    if examples.exists():
        shutil.rmtree(examples)

    subprocess.check_call(
        [
            "git",
            "clone",
            "--depth",
            "1",
            "https://github.com/jupyterlab/extension-examples.git",
            str(examples),
        ],
        cwd=str(root),
    )

    return examples


def _sync_examples_to_lite_contents(root):
    import shutil

    examples = _ensure_extension_examples(root)
    lite_examples_root = root / "docs" / "content" / "extension-examples"
    if lite_examples_root.exists():
        shutil.rmtree(lite_examples_root)
    lite_examples_root.mkdir(parents=True, exist_ok=True)

    ignored = shutil.ignore_patterns(
        ".git",
        "node_modules",
        "lib",
        "dist",
        ".ipynb_checkpoints",
    )

    copied_count = 0
    for example_dir in sorted(examples.iterdir()):
        if not example_dir.is_dir() or example_dir.name.startswith("."):
            continue

        src_dir = example_dir / "src"
        if not src_dir.is_dir():
            continue
        if not ((src_dir / "index.ts").exists() or (src_dir / "index.js").exists()):
            continue

        shutil.copytree(
            example_dir,
            lite_examples_root / example_dir.name,
            ignore=ignored,
        )
        copied_count += 1

    print(f"Copied {copied_count} extension examples into docs/content for Lite.")


def on_config_inited(*args):
    import sys
    import subprocess
    from pathlib import Path

    HERE = Path(__file__)
    ROOT = HERE.parent.parent
    _sync_examples_to_lite_contents(ROOT)

    subprocess.check_call(["jlpm"], cwd=str(ROOT))
    subprocess.check_call(["jlpm", "build"], cwd=str(ROOT))

    subprocess.check_call([sys.executable, "-m", "build"], cwd=str(ROOT))


def setup(app):
    app.connect("config-inited", on_config_inited)
