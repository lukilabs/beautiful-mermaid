# mermaid-class

Expert skill for UML class diagrams with beautiful-mermaid.

## When to Use

- "class diagram", "UML", "object model", "inheritance"
- Visualizing code architecture, type hierarchies, object relationships
- Documenting domain models, data structures, or design patterns

## Basic Syntax

```mermaid
classDiagram
  class Animal {
    +String name
    +int age
    +makeSound()
  }
```

## Class Definition

### Simple Class

```mermaid
classDiagram
  class User
```

### Class with Members

```mermaid
classDiagram
  class User {
    +String username
    +String email
    -String passwordHash
    +login(password) bool
    +logout()
    #validateEmail() bool
  }
```

### Generic Types

```mermaid
classDiagram
  class List~T~ {
    +add(T item)
    +get(int index) T
    +size() int
  }
```

## Visibility Modifiers

| Symbol | Visibility |
|--------|------------|
| `+` | Public |
| `-` | Private |
| `#` | Protected |
| `~` | Package/Internal |

```mermaid
classDiagram
  class Example {
    +publicField
    -privateField
    #protectedField
    ~packageField
    +publicMethod()
    -privateMethod()
  }
```

## Member Syntax

### Attributes

```mermaid
classDiagram
  class Product {
    +int id
    +String name
    +float price
    +bool isActive
    +List~String~ tags
  }
```

### Methods

```mermaid
classDiagram
  class UserService {
    +create(User user) User
    +findById(int id) User
    +update(int id, User data) User
    +delete(int id) bool
    +list(int page, int size) List~User~
  }
```

### Static Members

```mermaid
classDiagram
  class MathUtils {
    +int PI$
    +int E$
    +abs(int x)$ int
    +max(int a, int b)$ int
  }
```

### Abstract Members

```mermaid
classDiagram
  class Shape {
    <<abstract>>
    +float x
    +float y
    +area()* float
    +perimeter()* float
  }
```

## Class Annotations

```mermaid
classDiagram
  class IRepository~T~ {
    <<interface>>
    +findById(id) T
    +save(T entity) T
    +delete(id) bool
  }

  class UserDTO {
    <<dto>>
    +int id
    +String name
  }

  class Config {
    <<enumeration>>
    DEV
    STAGING
    PROD
  }

  class HttpService {
    <<service>>
    +get(url) Response
    +post(url, data) Response
  }
```

## Relationships

### Inheritance (extends)

```mermaid
classDiagram
  Animal <|-- Dog
  Animal <|-- Cat

  class Animal {
    +String name
    +makeSound()
  }
  class Dog {
    +fetch()
  }
  class Cat {
    +scratch()
  }
```

### Implementation (implements)

```mermaid
classDiagram
  IRepository~User~ <|.. UserRepository

  class IRepository~T~ {
    <<interface>>
    +findById(id) T
    +save(T entity) T
  }
  class UserRepository {
    +findById(id) User
    +save(User entity) User
  }
```

### Composition (strong "has-a")

```mermaid
classDiagram
  House *-- Room

  class House {
    +String address
  }
  class Room {
    +String name
    +int sqft
  }
```

### Aggregation (weak "has-a")

```mermaid
classDiagram
  Team o-- Player

  class Team {
    +String name
  }
  class Player {
    +String name
    +int number
  }
```

### Association

```mermaid
classDiagram
  Student --> Course

  class Student {
    +String name
  }
  class Course {
    +String title
  }
```

### Dependency

```mermaid
classDiagram
  UserController ..> UserService

  class UserController {
    +getUser(id) Response
  }
  class UserService {
    +findById(id) User
  }
```

### Relationship Summary

| Syntax | Relationship | Description |
|--------|--------------|-------------|
| `<\|--` | Inheritance | Child extends parent |
| `<\|..` | Realization | Class implements interface |
| `*--` | Composition | Part cannot exist without whole |
| `o--` | Aggregation | Part can exist independently |
| `-->` | Association | Uses/references |
| `..>` | Dependency | Depends on |
| `--` | Link | Simple connection |

## Cardinality

```mermaid
classDiagram
  Customer "1" --> "*" Order : places
  Order "1" --> "1..*" LineItem : contains
  Product "1" --> "0..*" LineItem : appears in
```

| Notation | Meaning |
|----------|---------|
| `1` | Exactly one |
| `0..1` | Zero or one |
| `*` | Zero or more |
| `1..*` | One or more |
| `n..m` | Range (n to m) |

## Relationship Labels

```mermaid
classDiagram
  User "1" --> "*" Post : creates
  User "1" --> "*" Comment : writes
  Post "1" --> "*" Comment : has
```

## Namespaces

```mermaid
classDiagram
  namespace Domain {
    class User
    class Order
    class Product
  }

  namespace Services {
    class UserService
    class OrderService
  }

  UserService --> User
  OrderService --> Order
```

## Common Patterns

### Repository Pattern

```mermaid
classDiagram
  class IRepository~T~ {
    <<interface>>
    +findById(id) T
    +findAll() List~T~
    +save(T entity) T
    +delete(id) bool
  }

  class UserRepository {
    -DataSource db
    +findById(id) User
    +findAll() List~User~
    +save(User user) User
    +delete(id) bool
  }

  class User {
    +int id
    +String name
    +String email
  }

  IRepository~User~ <|.. UserRepository
  UserRepository --> User
```

### Factory Pattern

```mermaid
classDiagram
  class VehicleFactory {
    <<abstract>>
    +createVehicle()* Vehicle
  }

  class CarFactory {
    +createVehicle() Vehicle
  }

  class BikeFactory {
    +createVehicle() Vehicle
  }

  class Vehicle {
    <<interface>>
    +start()
    +stop()
  }

  class Car {
    +start()
    +stop()
    +openTrunk()
  }

  class Bike {
    +start()
    +stop()
    +ringBell()
  }

  VehicleFactory <|-- CarFactory
  VehicleFactory <|-- BikeFactory
  Vehicle <|.. Car
  Vehicle <|.. Bike
  CarFactory ..> Car : creates
  BikeFactory ..> Bike : creates
```

### Service Layer

```mermaid
classDiagram
  class UserController {
    -UserService service
    +getUser(id) Response
    +createUser(data) Response
  }

  class UserService {
    -UserRepository repo
    -PasswordEncoder encoder
    +findById(id) User
    +create(UserDTO dto) User
  }

  class UserRepository {
    -DataSource db
    +findById(id) User
    +save(User user) User
  }

  UserController --> UserService
  UserService --> UserRepository
  UserService --> PasswordEncoder
```

### Domain Model

```mermaid
classDiagram
  class Order {
    +int id
    +Date createdAt
    +OrderStatus status
    +addItem(Product, qty)
    +removeItem(Product)
    +calculateTotal() Money
  }

  class OrderItem {
    +Product product
    +int quantity
    +Money unitPrice
    +subtotal() Money
  }

  class Product {
    +int id
    +String name
    +Money price
    +String description
  }

  class Customer {
    +int id
    +String name
    +String email
    +List~Order~ orders
  }

  Order "1" *-- "*" OrderItem
  OrderItem --> Product
  Customer "1" --> "*" Order
```

## Rendering

```typescript
import { renderMermaid, THEMES } from 'beautiful-mermaid'

const classDiagram = `
classDiagram
  class Animal {
    +String name
    +makeSound()
  }
  Animal <|-- Dog
  Animal <|-- Cat
`

// SVG output
const svg = await renderMermaid(classDiagram, THEMES['github-light'])

// ASCII output
import { renderMermaidAscii } from 'beautiful-mermaid'
const ascii = renderMermaidAscii(classDiagram)
```

## Tips

1. **Use visibility modifiers**: Always mark public/private/protected
2. **Show key relationships**: Don't clutter with every dependency
3. **Group by namespace**: Organize related classes together
4. **Add annotations**: Mark interfaces, abstracts, enums clearly
5. **Include cardinality**: Shows important constraints
6. **Keep methods concise**: Show signatures, not implementations
