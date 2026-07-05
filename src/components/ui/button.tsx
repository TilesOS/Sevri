import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link, { type LinkProps } from "next/link";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "contrast" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "xl";

interface CommonButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

type ButtonAsButtonProps = CommonButtonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children"> & {
    href?: undefined;
  };

type ButtonAsLinkProps = CommonButtonProps &
  Omit<LinkProps, "href" | "className"> &
  Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children"> & {
    href: LinkProps["href"];
  };

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "border border-transparent bg-primary text-ink shadow-soft hover:bg-primary-hover hover:shadow-lifted active:translate-y-px active:shadow-soft",
  secondary:
    "border border-transparent bg-navy text-cream shadow-soft hover:bg-navy-deep active:translate-y-px",
  outline: "border border-line bg-transparent text-ink hover:border-line-strong hover:bg-surface",
  ghost: "border border-transparent bg-transparent text-ink hover:bg-surface",
  contrast: "border border-transparent bg-cream text-navy shadow-soft hover:bg-white active:translate-y-px",
  danger: "border border-transparent bg-red-600 text-white shadow-soft hover:bg-red-700 active:translate-y-px",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
  xl: "h-14 px-7 text-base",
};

function getButtonClassName({
  variant,
  size,
  className,
  fullWidth,
}: Pick<CommonButtonProps, "variant" | "size" | "className" | "fullWidth">) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-60",
    "focus-visible:outline-none",
    variantClass[variant ?? "primary"],
    sizeClass[size ?? "md"],
    fullWidth && "w-full",
    className,
  );
}

export function Button(props: ButtonProps) {
  const {
    className,
    variant = "primary",
    size = "md",
    children,
    fullWidth,
    leadingIcon,
    trailingIcon,
  } = props;

  const content = (
    <>
      {leadingIcon ? <span className="shrink-0">{leadingIcon}</span> : null}
      <span>{children}</span>
      {trailingIcon ? <span className="shrink-0">{trailingIcon}</span> : null}
    </>
  );

  if ("href" in props && props.href !== undefined) {
    const {
      href,
      prefetch,
      replace,
      scroll,
      onClick,
      variant: _variant,
      size: _size,
      className: _className,
      children: _children,
      fullWidth: _fullWidth,
      leadingIcon: _leadingIcon,
      trailingIcon: _trailingIcon,
      ...rest
    } = props;
    void _variant;
    void _size;
    void _className;
    void _children;
    void _fullWidth;
    void _leadingIcon;
    void _trailingIcon;
    const classNames = getButtonClassName({ variant, size, className, fullWidth });
    const isExternal = typeof href === "string" && /^(https?:)?\/\//.test(href);

    if (isExternal) {
      return (
        <a
          href={href as string}
          className={classNames}
          onClick={onClick}
          {...rest}
        >
          {content}
        </a>
      );
    }

    return (
      <Link
        href={href}
        prefetch={prefetch}
        replace={replace}
        scroll={scroll}
        className={classNames}
        onClick={onClick}
        {...rest}
      >
        {content}
      </Link>
    );
  }

  const {
    type = "button",
    variant: _variant,
    size: _size,
    className: _className,
    children: _children,
    fullWidth: _fullWidth,
    leadingIcon: _leadingIcon,
    trailingIcon: _trailingIcon,
    ...rest
  } = props;
  void _variant;
  void _size;
  void _className;
  void _children;
  void _fullWidth;
  void _leadingIcon;
  void _trailingIcon;
  return (
    <button
      type={type}
      className={getButtonClassName({ variant, size, className, fullWidth })}
      {...rest}
    >
      {content}
    </button>
  );
}
