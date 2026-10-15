/**
 * Prettier 配置（P5.3 / V24）。
 *
 * 纪律：formatter 只对**新生成代码**与显式 `npm run format` 生效；
 * 不做全库一次性格式重写（Spec §4.1 P5 行：不全库盲目格式重写——
 * 大 diff 淹没真实变更）。既有文件保持现状，改动哪个格式化哪个。
 *
 * 与 ESLint 风格规则的关系：ESLint 的 indent/quotes/semi 等格式类规则
 * 保留不动（既有口径），prettier 是独立通道——两者冲突时以 prettier 输出
 * 为准（format 后跑 lint:fix 收敛无实质冲突）。
 */
export default {
  semi: true,
  singleQuote: true,
  printWidth: 120,
  tabWidth: 2,
  trailingComma: 'all',
  arrowParens: 'always',
  endOfLine: 'lf',
  overrides: [
    {
      files: '*.md',
      options: { proseWrap: 'preserve' },
    },
  ],
};
