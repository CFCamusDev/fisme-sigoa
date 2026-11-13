import fs from 'node:fs';
let p = 'catalog-item-form.tsx';
let s = fs.readFileSync(p, 'utf8');
const rep = (a, b) => {
  if (!s.includes(a)) throw new Error(a);
  s = s.replace(a, b);
};
rep(
  `    defaultValues: {
      code: item?.code ?? '',
      name: item && hasName(item) ? item.name : '',
      statement: item?.statement ?? '',
    },`,
  `    // El esquema de los OE es estricto: el campo \`name\` solo existe en los AG.
    defaultValues: isAttribute
      ? {
          code: item?.code ?? '',
          name: item && hasName(item) ? item.name : '',
          statement: item?.statement ?? '',
        }
      : { code: item?.code ?? '', statement: item?.statement ?? '' },`,
);
fs.writeFileSync(p, s);
p = 'catalog-version-editor-page.test.tsx';
s = fs.readFileSync(p, 'utf8');
rep(
  'expect(within(row).getByText(/nuevo/i)).toBeInTheDocument();\n      expect(within(objectives).getAllByText(/nuevo/i)).toHaveLength(1);',
  'expect(await within(row).findByText(/nuevo/i)).toBeInTheDocument();\n      expect(within(objectives).getAllByText(/nuevo/i)).toHaveLength(1);',
);
rep(
  'expect(screen.getByText(/ya no están en esta versión: OEP2, OEP3/i)).toBeInTheDocument();',
  'expect(await screen.findByText(/ya no están en esta versión: OEP2, OEP3/i)).toBeInTheDocument();',
);
rep(
  'expect(await screen.findByText(/aprobada \(vigente\)/i)).toBeInTheDocument();',
  'expect((await screen.findAllByText(/aprobada \(vigente\)/i)).length).toBeGreaterThan(0);',
);
fs.writeFileSync(p, s);
