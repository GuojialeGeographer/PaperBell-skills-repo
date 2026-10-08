---
title: "Collective memory of drought in North China"
acronym: "Bad"
bibliography: "refs.bib"
csl: ""
corresponding: "yes"
---

```{=latex}
\renewcommand{\thefigure}{S\arabic{figure}}
\renewcommand{\thetable}{S\arabic{table}}
```

## Methods

We swept four parameters of the memory model, as summarised in @tbl:params and
in the grading rules of Table \ref{tbl:nowhere}.

| Parameter | Default | Swept range |
|---|---|---|
| Memory length | 20 | 5-50 |
| Loss rate | 0.05 | 0.01-0.2 |

```xlsx-table
file: Bad_Tables.xlsx
sheet: Table 1
caption: Parameters of the memory model, with the range each was swept over.
label: tbl:params
```

Model fit is reported in Table \ref{tbl:fit}.

```xlsx-table
file: Bad_Tables.xlsx
sheet: Table 2
caption: Model fit against the two withheld archives.
label: tbl:fit
skip_n: 1
```

The grading determinations are in Table \ref{tbl:grades}.

```xlsx-table
file: Bad_Tables.xlsx
sheet: Table S3
caption: Grading determinations, with the rule applied to each.
label: tbl:grades
skip_n: 1
```

Sensitivity results are in Table \ref{tbl:sens}.

```xlsx-table
file: Bad_Tables.xlsx
sheet: Table 9
caption: Sensitivity of recall to the loss rate.
label: tbl:sens
skip_n: 1
```

Archive coverage is in Table \ref{tbl:cover}.

```xlsx-table
file: Missing_Tables.xlsx
sheet: Table 5
caption: Coverage of each archive.
label: tbl:cover
skip_n: 1
```

## Results

Recall fell as the loss rate rose.

```xlsx-table
file: Bad_Tables.xlsx
sheet: Table 2
label: tbl:unfloated
skip_n: 1
```

## Figures

The study region is shown in Figure \ref{fig:nowhere}, and the archive density
in Figure \ref{fig:density}. Grading follows [@ghost2099].

![The study region, with one marker per documentary archive.](ColMemo_study_area.png){#fig:site}

![Decadal density of gazetteer works across the study period.](Missing_Figure.png){#fig:density}

![A panel with a caption and no label at all, which nothing can refer to.](ColMemo_study_area.png)
