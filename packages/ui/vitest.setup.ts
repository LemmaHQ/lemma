import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

Reflect.deleteProperty(Element.prototype, "animate");

afterEach(cleanup);
