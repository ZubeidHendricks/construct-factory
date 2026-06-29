# reference/

Real Construct 3 projects used as **ground truth** for the schema in
`packages/c3-format/src/schema.js`.

## How to add one

In Construct 3 (editor.construct.net), build the smallest project that exercises
the features you want the factory to generate, then export it here:

- **Easiest:** Menu → Project → *Save as…* → **Download a copy** → save the `.c3p`
  into this folder. Works in any browser.
- **Or** save as a project folder (Chromium browsers only) directly into a
  subfolder here.

## Then

Unpack and inspect:

```bash
node verify/c3p.js unpack reference/hello.c3p reference/hello
node verify/validate.js reference/hello   # will fail until schema.js matches reality — that's expected
```

The diff between this real JSON and our PROVISIONAL `schema.js` is the work list
for making `c3-format` correct.
