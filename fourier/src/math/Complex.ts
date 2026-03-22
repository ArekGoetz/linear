export class Complex {
  constructor(public re = 0, public im = 0) {}

  add(o: Complex): Complex {
    return new Complex(this.re + o.re, this.im + o.im);
  }

  sub(o: Complex): Complex {
    return new Complex(this.re - o.re, this.im - o.im);
  }

  mul(o: Complex): Complex {
    return new Complex(
      this.re * o.re - this.im * o.im,
      this.re * o.im + this.im * o.re
    );
  }

  scale(s: number): Complex {
    return new Complex(this.re * s, this.im * s);
  }

  divScalar(s: number): Complex {
    return new Complex(this.re / s, this.im / s);
  }

  mag(): number {
    return Math.hypot(this.re, this.im);
  }

  clone(): Complex {
    return new Complex(this.re, this.im);
  }
}
