namespace Datacenter.Api.Tests;

public class ScaffoldSmokeTest
{
    [Fact]
    public void TestProjectReferencesAndLoadsBackendAssembly()
    {
        // 验证测试项目可引用 Datacenter.Api 程序集中的类型
        var programType = typeof(global::Program);
        Assert.NotNull(programType);
    }
}
