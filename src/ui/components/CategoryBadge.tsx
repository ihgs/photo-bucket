import { categoryInfo, type Category } from "../../domain/types";

export const CategoryBadge = ({ category }: { category: Category }) => {
  const info = categoryInfo(category);
  return (
    <span class="category-badge" style={{ color: info.color }}>
      {info.label}
    </span>
  );
};
